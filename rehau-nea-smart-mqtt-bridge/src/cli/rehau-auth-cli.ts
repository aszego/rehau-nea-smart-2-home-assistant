#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';

// Minimal arg parsing
function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  let key: string | null = null;
  for (const a of argv) {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        const k = a.substring(2, eq);
        args[k] = a.substring(eq + 1);
        key = null;
      } else {
        key = a.substring(2);
        // default boolean true; value may follow
        args[key] = true;
      }
    } else if (key) {
      args[key] = a;
      key = null;
    }
  }
  return args;
}

async function main() {
  const argv = parseArgs(process.argv.slice(2));

  // Configure environment before loading modules that create the logger
  const quiet = !!argv['quiet'];
  if (quiet) process.env.LOG_LEVEL = 'error';

  const headlessFlag = argv['headless'];
  const headless = headlessFlag === true || String(headlessFlag) === 'true';
  // Default to visible browser unless --headless is passed
  process.env.PLAYWRIGHT_HEADLESS = headless ? 'true' : 'false';

  // Map provided CLI options to env vars (optional POP3 only when provided)
  if (argv['email']) process.env.EMAIL = String(argv['email']);
  if (argv['password']) process.env.PASSWORD = String(argv['password']);
  if (argv['pop3-email']) process.env.POP3_EMAIL = String(argv['pop3-email']);
  if (argv['pop3-password']) process.env.POP3_PASSWORD = String(argv['pop3-password']);
  if (argv['pop3-host']) process.env.POP3_HOST = String(argv['pop3-host']);
  if (argv['pop3-port']) process.env.POP3_PORT = String(argv['pop3-port']);
  if (argv['pop3-secure']) process.env.POP3_SECURE = String(argv['pop3-secure']);
  if (argv['pop3-from-address']) process.env.POP3_FROM_ADDRESS = String(argv['pop3-from-address']);
  if (argv['pop3-timeout']) process.env.POP3_TIMEOUT = String(argv['pop3-timeout']);
  if (argv['simulate-disconnect-seconds']) process.env.SIMULATE_DISCONNECT_AFTER_SECONDS = String(argv['simulate-disconnect-seconds']);
  if (argv['force-fresh-login']) process.env.FORCE_FRESH_LOGIN = 'true';
  if (argv['force-token-expired']) process.env.FORCE_TOKEN_EXPIRED = 'true';

  // Allow dotenv if present
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const dotenv = require('dotenv');
    dotenv.config();
  } catch (e) {
    // ignore if dotenv not available
  }

  // Basic validation
  const email = process.env.EMAIL || process.env.REHAU_EMAIL || argv['email'];
  const password = process.env.PASSWORD || argv['password'];

  if (!email || !password) {
    console.error(JSON.stringify({ error: 'Missing required parameters', details: 'Provide --email and --password' }));
    process.exit(1);
  }

  // Dynamically import after env vars set so logger respects LOG_LEVEL
  let RehauAuthPersistent: any;
  try {
    const mod = await import('../rehau-auth');
    const anyMod = mod as any;
    RehauAuthPersistent = anyMod.default || anyMod.RehauAuthPersistent || anyMod;
  } catch (err) {
    console.error(JSON.stringify({ error: 'Failed to load RehauAuthPersistent', details: String(err) }));
    process.exit(2);
  }

  const reveal = !!argv['reveal-tokens'];
  const maskTokens = !reveal;

  const mask = (t: string | null) => {
    if (!t) return null;
    if (!maskTokens) return t;
    if (t.length <= 12) return '***';
    return `${t.substring(0, 6)}...${t.substring(t.length - 6)}`;
  };

  // Instantiate and run
  const auth: any = new RehauAuthPersistent(String(email), String(password));

  try {
    // If user requested fresh login, set env to force it
    if (argv['force-fresh-login']) process.env.FORCE_FRESH_LOGIN = 'true';

    await auth.ensureValidToken();

    const out: any = {
      accessToken: null,
      refreshToken: null,
      tokenExpiry: auth['tokenExpiry'] || null,
      installs: auth.getInstalls ? auth.getInstalls() : [],
      statistics: auth.getStatistics ? auth.getStatistics() : {}
    };

    const access = auth.getAccessToken ? auth.getAccessToken() : null;
    const refresh = auth['refreshToken'] || (auth.getRefreshToken ? auth.getRefreshToken() : null) || null;

    out.accessToken = mask(access);
    out.refreshToken = mask(refresh);

    const outputJson = JSON.stringify({ success: true, data: out }, null, 2);

    if (argv['output-file']) {
      const outPath = path.resolve(String(argv['output-file']));
      fs.writeFileSync(outPath, outputJson, { encoding: 'utf8', mode: 0o600 });
      console.log(JSON.stringify({ success: true, savedTo: outPath }));
    } else {
      console.log(outputJson);
    }

    // Cleanup resources
    if (auth.cleanup) {
      try { auth.cleanup(); } catch (_) {}
    }

    process.exit(0);
  } catch (error: any) {
    const errOut = {
      error: 'Authentication failed',
      message: error?.message || String(error),
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    };
    console.error(JSON.stringify(errOut, null, 2));
    try { if (auth && auth.cleanup) auth.cleanup(); } catch (_) {}
    process.exit(3);
  }
}

main();
