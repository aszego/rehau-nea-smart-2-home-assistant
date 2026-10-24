import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname } from 'path';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;
}

export class TokenStore {
  private readonly fingerprint: string;

  constructor(private readonly path: string | undefined, email: string, accessToken: string, refreshToken: string) {
    this.fingerprint = createHash('sha256').update(JSON.stringify([email, accessToken, refreshToken])).digest('hex');
  }

  load(): StoredTokens | null {
    if (!this.path || !existsSync(this.path)) return null;
    const stored = JSON.parse(readFileSync(this.path, 'utf8'));
    // A changed configuration must override tokens rotated from the previous configuration.
    if (stored.fingerprint !== this.fingerprint) return null;
    if (typeof stored.accessToken !== 'string' || !stored.accessToken ||
        typeof stored.refreshToken !== 'string' || !stored.refreshToken ||
        !Number.isFinite(stored.tokenExpiry)) {
      throw new Error('Invalid persisted REHAU tokens');
    }
    return stored;
  }

  save(tokens: StoredTokens): void {
    if (!this.path) return;
    mkdirSync(dirname(this.path), { recursive: true });
    const temporaryPath = `${this.path}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify({ fingerprint: this.fingerprint, ...tokens }), { mode: 0o600 });
    renameSync(temporaryPath, this.path);
  }
}
