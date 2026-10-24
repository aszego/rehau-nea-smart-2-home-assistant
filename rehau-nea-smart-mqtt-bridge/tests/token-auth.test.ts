import axios from 'axios';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import RehauAuthPersistent from '../src/rehau-auth';
import { TokenStore } from '../src/token-store';
import { ConfigValidator } from '../src/config-validator';
import { StatusPublisher } from '../src/ha-integration/status-publisher';
import type RehauMQTTBridge from '../src/mqtt-bridge';

jest.mock('axios');
jest.mock('../src/logger', () => ({ __esModule: true, default: { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() }, registerObfuscation: jest.fn(), debugDump: jest.fn() }));
jest.mock('../src/parsers', () => ({ UserDataParserV2: jest.fn().mockImplementation(() => ({ parse: () => ({ installations: [{ unique: 'install', name: 'Home', _id: 'id' }] }), getSummary: jest.fn() })) }));
const http = axios as jest.Mocked<typeof axios>;
const jwt = (seconds: number) => `header.${Buffer.from(JSON.stringify({ exp: (Date.now() / 1000) + seconds })).toString('base64url')}.signature`;

describe('token-only authentication', () => {
  let auth: RehauAuthPersistent;
  let directory: string;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    directory = mkdtempSync(join(tmpdir(), 'rehau-token-test-'));
    auth = new RehauAuthPersistent('user@example.com', jwt(3600), 'refresh', join(directory, 'tokens.json'));
    http.post.mockResolvedValue({ data: { access_token: 'renewed', refresh_token: 'rotated', expires_in: 3600 } });
    http.get.mockResolvedValue({ status: 200, data: {} });
  });
  afterEach(() => { auth.cleanup(); jest.useRealTimers(); rmSync(directory, { recursive: true, force: true }); });

  test('validates refresh token and access rights immediately and loads installations', async () => {
    await auth.ensureValidToken();
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/users/user@example.com/getUserData'), expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'renewed' }), timeout: 15000 }));
    expect(auth.getInstalls()).toEqual([{ unique: 'install', name: 'Home', _id: 'id' }]);
    await auth.ensureValidToken();
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(http.get).toHaveBeenCalledTimes(1);
  });

  test('renews five minutes before expiry even when configured interval is six hours', async () => {
    await auth.ensureValidToken();
    await jest.advanceTimersByTimeAsync(3299000);
    expect(http.post).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1000);
    expect(http.post).toHaveBeenCalledTimes(2);
  });

  test('deduplicates concurrent refresh requests and keeps refresh token if not rotated', async () => {
    http.post.mockResolvedValue({ data: { access_token: 'new', expires_in: 3600 } });
    await Promise.all([auth.refresh(), auth.refresh()]);
    expect(http.post).toHaveBeenCalledTimes(1);
    await auth.refresh();
    expect(http.post.mock.calls[1][1]).toEqual(expect.objectContaining({ refresh_token: 'refresh' }));
  });

  test('reports renewal failure without leaking tokens, retries and clears error after recovery', async () => {
    const listener = jest.fn();
    auth.onTokenStatus(listener);
    http.isAxiosError.mockImplementation((error: unknown): error is import('axios').AxiosError => !!(error as { isAxiosError?: boolean })?.isAxiosError);
    http.post.mockRejectedValueOnce({ isAxiosError: true, response: { status: 401, data: 'SECRET' }, config: { refresh_token: 'SECRET' } });
    await expect(auth.ensureValidToken()).rejects.toThrow('HTTP 401');
    expect(listener).toHaveBeenLastCalledWith({ state: 'failed', error: true, error_text: 'REHAU request failed (HTTP 401)' });
    await jest.advanceTimersByTimeAsync(60000);
    expect(listener).toHaveBeenLastCalledWith({ state: 'authenticated', error: false, error_text: '' });
  });

  test('rejects failed server validation rather than silently accepting no installations', async () => {
    http.get.mockRejectedValueOnce(new Error('User data unavailable'));
    await expect(auth.ensureValidToken()).rejects.toThrow('User data unavailable');
    expect(auth.isAuthenticated()).toBe(false);
  });

  test.each([{ access_token: 'new', expires_in: 0 }, { access_token: '', refresh_token: 'new', expires_in: 3600 }])('rejects malformed renewal response %j', async data => {
    http.post.mockResolvedValue({ data });
    await expect(auth.refresh()).rejects.toThrow('Invalid REHAU token renewal response');
  });

  test('persists rotated tokens and restores them after restart with unchanged options', async () => {
    const initial = jwt(3600);
    auth.cleanup();
    auth = new RehauAuthPersistent('user@example.com', initial, 'refresh', join(directory, 'tokens.json'));
    await auth.ensureValidToken();
    auth.cleanup();
    auth = new RehauAuthPersistent('user@example.com', initial, 'refresh', join(directory, 'tokens.json'));
    await auth.ensureValidToken();
    expect(http.post.mock.calls[1][1]).toEqual(expect.objectContaining({ refresh_token: 'rotated' }));
    const changed = new TokenStore(join(directory, 'tokens.json'), 'user@example.com', 'replacement', 'replacement');
    expect(changed.load()).toBeNull();
  });

  test('a corrupt persisted file falls back to configured tokens', async () => {
    auth.cleanup();
    writeFileSync(join(directory, 'tokens.json'), 'not JSON');
    auth = new RehauAuthPersistent('user@example.com', jwt(3600), 'replacement-refresh', join(directory, 'tokens.json'));
    await auth.ensureValidToken();
    expect(http.post.mock.calls[0][1]).toEqual(expect.objectContaining({ refresh_token: 'replacement-refresh' }));
  });

  test('expired-token renewal failures retry after one minute, not every second', async () => {
    auth.cleanup();
    auth = new RehauAuthPersistent('user@example.com', jwt(-1), 'refresh');
    http.post.mockRejectedValue(new Error('Renewal unavailable'));
    await expect(auth.ensureValidToken()).rejects.toThrow('Renewal unavailable');
    await jest.advanceTimersByTimeAsync(59000);
    expect(http.post).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1000);
    expect(http.post).toHaveBeenCalledTimes(2);
  });

  test('cleanup stops scheduled renewal', async () => {
    await auth.ensureValidToken();
    auth.cleanup();
    await jest.advanceTimersByTimeAsync(7200000);
    expect(http.post).toHaveBeenCalledTimes(1);
  });

  test('requires email and both tokens without a password or environment fallback', () => {
    expect(ConfigValidator.validateRehauConfig({ email: 'user@example.com', accessToken: 'access', refreshToken: 'refresh' })).toEqual([]);
    expect(ConfigValidator.validateRehauConfig({ email: '', accessToken: '', refreshToken: '' }).map(error => error.field)).toEqual(['REHAU_EMAIL', 'REHAU_ACCESS_TOKEN', 'REHAU_REFRESH_TOKEN']);
  });

  test('publishes diagnostic discovery and retained error attributes, then clears them', async () => {
    const publishToHomeAssistant = jest.fn();
    const status = new StatusPublisher({ publishToHomeAssistant } as unknown as RehauMQTTBridge);
    await status.initialize();
    expect(publishToHomeAssistant).toHaveBeenCalledWith('homeassistant/sensor/rehau_token_status/config', expect.objectContaining({ json_attributes_topic: 'homeassistant/sensor/rehau_token_status/state' }), { retain: true });
    status.setTokenStatus({ state: 'failed', error: true, error_text: 'HTTP 401' });
    expect(publishToHomeAssistant).toHaveBeenLastCalledWith('homeassistant/sensor/rehau_token_status/state', { state: 'failed', error: true, error_text: 'HTTP 401' }, { retain: true });
    status.setTokenStatus({ state: 'authenticated', error: false, error_text: '' });
    expect(publishToHomeAssistant).toHaveBeenLastCalledWith('homeassistant/sensor/rehau_token_status/state', { state: 'authenticated', error: false, error_text: '' }, { retain: true });
    status.cleanup();
  });
});
