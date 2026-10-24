import axios, { AxiosError } from 'axios';
import * as crypto from 'crypto';
import logger, { registerObfuscation, debugDump } from './logger';
import { RehauTokenResponse } from './types';
import { UserDataParserV2, InstallationDataParserV2, type IInstall } from './parsers';
import { TokenStore } from './token-store';

function isAxiosError(error: unknown): error is AxiosError {
  return axios.isAxiosError(error);
}
interface InstallInfo { unique: string; name: string; _id: string; }
export interface TokenStatus {
  state: 'validating' | 'authenticated' | 'refreshing' | 'failed';
  error: boolean;
  error_text: string;
}
class RehauAuthPersistent {
  private clientId = `app-${crypto.randomUUID()}`;
  private accessToken: string;
  private refreshToken: string;
  private tokenExpiry: number | null = null;
  private installs: InstallInfo[] = [];
  private tokenRefreshTimer: NodeJS.Timeout | null = null;
  private tokenRefreshInterval: number;
  private isCleanedUp = false;
  private startTime = Date.now();
  private tokenRefreshCount = 0;
  private refreshPromise: Promise<boolean> | null = null;
  private validationPromise: Promise<void> | null = null;
  private validated = false;
  private tokenStore: TokenStore;
  private status: TokenStatus = { state: 'validating', error: false, error_text: '' };
  private statusListener?: (status: TokenStatus) => void;

  constructor(private email: string, accessToken: string, refreshToken: string, storePath = process.env.REHAU_TOKEN_STORE_PATH) {
    this.accessToken = accessToken.trim();
    this.refreshToken = refreshToken.trim();
    this.tokenStore = new TokenStore(storePath, email, this.accessToken, this.refreshToken);
    this.tokenRefreshInterval = Number(process.env.TOKEN_REFRESH_INTERVAL || '21600') * 1000;
    let stored = null;
    try {
      stored = this.tokenStore.load();
    } catch {
      logger.warn('Could not read persisted REHAU tokens; validating configured tokens instead');
    }
    if (stored) {
      this.accessToken = stored.accessToken;
      this.refreshToken = stored.refreshToken;
      this.tokenExpiry = stored.tokenExpiry;
    } else {
      try {
        const payload = JSON.parse(Buffer.from(this.accessToken.split('.')[1], 'base64url').toString('utf8'));
        if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) this.tokenExpiry = payload.exp * 1000;
      } catch { /* Opaque tokens are validated by the server. */ }
    }
    registerObfuscation('email', email);
  }

  onTokenStatus(listener: (status: TokenStatus) => void): void {
    this.statusListener = listener;
    listener({ ...this.status });
  }

  private setStatus(state: TokenStatus['state'], errorText = ''): void {
    this.status = { state, error: state === 'failed', error_text: errorText };
    this.statusListener?.({ ...this.status });
  }

  private errorMessage(error: unknown): string {
    // Axios configs and server bodies can contain credentials; never publish them.
    if (isAxiosError(error)) return error.response ? `REHAU request failed (HTTP ${error.response.status})` : 'REHAU request failed (network error or timeout)';
    return error instanceof Error ? error.message : 'REHAU token validation or renewal failed';
  }

  private startTokenRefresh(retry = false): void {
    this.stopTokenRefresh();
    if (this.isCleanedUp) return;
    const untilExpiry = this.tokenExpiry === null ? this.tokenRefreshInterval : this.tokenExpiry - Date.now() - 300000;
    const delay = retry ? 60000 : Math.max(1000, Math.min(this.tokenRefreshInterval, untilExpiry));
    this.tokenRefreshTimer = setTimeout(() => {
      this.tokenRefreshTimer = null;
      void this.refresh().catch(() => undefined);
    }, delay);
  }

  stopTokenRefresh(): void {
    if (this.tokenRefreshTimer) clearTimeout(this.tokenRefreshTimer);
    this.tokenRefreshTimer = null;
  }

  cleanup(): void {
    this.isCleanedUp = true;
    this.stopTokenRefresh();
  }

  refresh(): Promise<boolean> {
    if (!this.refreshPromise) this.refreshPromise = this.renewToken().finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }

  private async renewToken(): Promise<boolean> {
    this.setStatus('refreshing');
    try {
      if (!this.refreshToken) throw new Error('REHAU refresh token is required');
      const response = await axios.post<RehauTokenResponse>(
        'https://accounts.rehau.com/token-srv/token',
        { grant_type: 'refresh_token', client_id: '3f5d915d-a06f-42b9-89cc-2e5d63aa96f1', refresh_token: this.refreshToken },
        { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
      );
      const tokens = response.data;
      if (typeof tokens.access_token !== 'string' || !tokens.access_token ||
          (tokens.refresh_token !== undefined && (typeof tokens.refresh_token !== 'string' || !tokens.refresh_token)) ||
          !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0) throw new Error('Invalid REHAU token renewal response');
      this.accessToken = tokens.access_token;
      this.refreshToken = tokens.refresh_token || this.refreshToken;
      this.tokenExpiry = Date.now() + tokens.expires_in * 1000;
      this.tokenStore.save({ accessToken: this.accessToken, refreshToken: this.refreshToken, tokenExpiry: this.tokenExpiry });
      this.tokenRefreshCount++;
      this.setStatus('authenticated');
      this.startTokenRefresh();
      return true;
    } catch (error) {
      this.setStatus('failed', this.errorMessage(error));
      logger.error(this.status.error_text);
      this.startTokenRefresh(true);
      throw new Error(this.status.error_text);
    }
  }

  isTokenExpired(): boolean {
    return this.tokenExpiry === null || Date.now() >= this.tokenExpiry - 300000;
  }

  ensureValidToken(): Promise<void> {
    if (!this.validationPromise) this.validationPromise = this.validateToken().finally(() => { this.validationPromise = null; });
    return this.validationPromise;
  }

  private async validateToken(): Promise<void> {
    try {
      if (!this.accessToken || !this.refreshToken) throw new Error('REHAU access and refresh tokens are required');
      if (!this.validated || this.isTokenExpired() || this.status.error) await this.refresh();
      if (!this.validated) {
        this.setStatus('validating');
        await this.getUserInfo();
        this.validated = true;
      }
      this.setStatus('authenticated');
      this.startTokenRefresh();
    } catch (error) {
      this.setStatus('failed', this.errorMessage(error));
      throw new Error(this.status.error_text);
    }
  }

  private async getUserInfo(): Promise<void> {
    try {
      logger.debug('Fetching user data...');
      
      const headers = {
        'Authorization': this.accessToken!,
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36',
        'Origin': 'http://android.neasmart.de',
        'Referer': 'http://android.neasmart.de/',
        'Accept': 'application/json, text/plain, */*'
      };

      const response = await axios.get(
        `https://api.nea2aws.aws.rehau.cloud/v2/users/${this.email}/getUserData`,
        { headers, timeout: 15000 }
      );

      // Log HTTP response details
      logger.info(`getUserData HTTP Response: status=${response.status}`);
      logger.debug('Response headers:', response.headers);
      
      // debugDump('getUserData API Response', response.data);

      // Use V2 parser to extract user data
      const parser = new UserDataParserV2();
      const parsed = parser.parse(response.data);
      
      this.installs = parsed.installations.map(install => ({
        unique: install.unique,
        name: install.name,
        _id: install._id
      }));
      
      logger.info(`Found ${this.installs.length} installation(s)`);
      logger.debug('Parsed user data:', parser.getSummary(parsed));
    } catch (error: unknown) {
      throw new Error(this.errorMessage(error));
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getClientId(): string {
    return this.clientId;
  }

  getEmail(): string {
    return this.email;
  }

  getInstalls(): InstallInfo[] {
    return this.installs;
  }

  getPrimaryInstallUnique(): string | null {
    return this.installs.length > 0 ? this.installs[0].unique : null;
  }

  isAuthenticated(): boolean {
    return this.validated && !this.isTokenExpired() && !this.status.error;
  }

  /**
   * Get system statistics
   */
  getStatistics() {
    const uptime = Date.now() - this.startTime;
    return {
      uptime: uptime,
      uptimeFormatted: this.formatUptime(uptime),
      tokenRefreshCount: this.tokenRefreshCount,
      fullAuthCount: 0,
      startTime: this.startTime
    };
  }

  /**
   * Format uptime in human-readable format
   */
  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get full installation data including zones and controllers
   */
  async getInstallationData(install: InstallInfo): Promise<IInstall> {
    try {
      await this.ensureValidToken();
      const installIds = this.installs.map(i => i._id).join(',');
      const url = `https://api.nea2aws.aws.rehau.cloud/v2/users/${this.email}/getDataofInstall` +
                  `?demand=${install._id}` +
                  `&installsList=${installIds}`;
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': this.accessToken!,
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
          'Origin': 'http://android.neasmart.de',
          'Referer': 'http://android.neasmart.de/',
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json'
        }
      });

      // Log HTTP response details
      logger.info(`getInstallationData HTTP Response: status=${response.status}`);
      logger.debug('Response headers:', response.headers);
      
      // Use condensed format for large installation data
      debugDump('getInstallationData API Response', response.data, true);
      
      // Use V2 parser to extract installation data
      const parser = new InstallationDataParserV2();
      const parsed = parser.parse(response.data, install.unique);
      
      logger.debug('Parsed installation data:', parser.getSummary(parsed));

      // Get typed installation data (without raw fields)
      const typedData = parser.getTyped(parsed);
      
      // Find the specific installation
      const installation = typedData.installs.find(i => i.unique === install.unique);
      if (!installation) {
        throw new Error(`Installation ${install.unique} not found in parsed data`);
      }
      
      return installation;
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        logger.error(`getInstallationData HTTP Error: status=${error.response?.status}`);
        logger.error('Error response headers:', error.response?.headers);
        logger.error('Error response body:', error.response?.data);
      }
      throw error;
    }
  }
}

export default RehauAuthPersistent;
