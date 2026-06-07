REHAU Auth CLI
=================

Quick CLI to run the `RehauAuthPersistent` login flow locally, open a visible Playwright browser for manual MFA, and print the resulting tokens and installations as JSON to stdout.

Requirements
------------
- Node.js (14+)
- Project dependencies installed (`npm install` in `rehau-nea-smart-mqtt-bridge`)
- Playwright browser binaries for local runs:

```
npx playwright install
```

Files
-----
- CLI entry: `src/cli/rehau-auth-cli.ts`

Usage (development)
-------------------
Run the CLI using the project's `ts-node` script (no Docker required):

```
npm run auth:cli:dev -- --email you@example.com --password "yourpassword"
```

Default behavior
----------------
- The CLI launches a visible (headful) Playwright browser so you can complete MFA manually in your browser.
- POP3/email automation is optional — only used if you pass `--pop3-email` and related flags or set POP3_* env vars.
- Output is JSON to stdout. Tokens are masked by default.

Important flags
---------------
- `--headless` — run Playwright headless (opposite of default visible browser)
- `--quiet` — suppress most logger output (useful for clean JSON)
- `--reveal-tokens` — show full tokens in output (use with caution)
- `--output-file <path>` — write output JSON to a file (written with mode 0600)

Optional POP3 flags (enable automated MFA if provided)
---------------------------------------------------
- `--pop3-email`, `--pop3-password`, `--pop3-host`, `--pop3-port`, `--pop3-secure`, `--pop3-from-address`, `--pop3-timeout`

Examples
--------
Visible browser, manual MFA, default masked tokens:

```
npm run auth:cli:dev -- --email you@example.com --password "secret"
```

Write full tokens to a file (explicit reveal):

```
npm run auth:cli:dev -- --email you@example.com --password "secret" --reveal-tokens --output-file ./rehau-tokens.json
```

Notes
-----
- The CLI does not require Docker. It runs locally and uses your installed Playwright/browser binaries.
- For automated CI use, prefer `--output-file` and secure storage of the produced tokens. Avoid `--reveal-tokens` in shared logs.

Troubleshooting
---------------
- If the browser does not open, ensure Playwright binaries are installed (`npx playwright install`) and that `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` is set if using a system Chromium.
- If authentication fails, run with `--quiet` omitted to see logger output, or set `NODE_ENV=development` for stack traces.
