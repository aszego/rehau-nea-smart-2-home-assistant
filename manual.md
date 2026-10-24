# REHAU NEA SMART 2.0 — Configuration Manual

This manual explains how to configure the token-authenticated MQTT bridge in Home Assistant, verify that it works, and recover when tokens can no longer be renewed. It describes the current implementation in this repository.

## 1. Understand the three sets of credentials

The bridge uses three independent connections. Do not interchange their credentials.

| Connection | Configuration fields | Purpose |
|---|---|---|
| REHAU cloud | `rehau_email`, `rehau_access_token`, `rehau_refresh_token` | Read installations and communicate with REHAU |
| Home Assistant MQTT broker | `mqtt_host`, `mqtt_port`, `mqtt_user`, `mqtt_password` | Publish discovered devices, entities, states, and receive commands |
| Bridge Web UI / REST API | `api_username`, `api_password`, `jwt_secret` | Protect the bridge's local administration interface |

**The bridge does not log into REHAU with a password.** You log in manually in your own browser to obtain tokens. If REHAU requires an email verification code, you read that email and enter the code yourself. No POP3, mailbox password, mailbox OAuth credentials, or Playwright configuration is needed.

Both REHAU tokens are required:

- The **access token** authorizes cloud requests.
- The **refresh token** allows the bridge to obtain a new access token without repeating browser login.

The REHAU email remains required because the cloud API and MQTT connection use it to identify your account.

## 2. Prepare Home Assistant and MQTT

Before obtaining tokens, make sure the infrastructure is ready:

1. Install the bridge add-on from the repository/version containing the token-only changes. See the [installation guide](docs/installation.md) for general installation steps. Do not assume an older published release already includes these changes.
2. Have an MQTT broker running. On Home Assistant OS, the **Mosquitto broker** add-on is a common choice.
3. In **Settings → Devices & services**, configure the **MQTT** integration to connect to that broker.
4. Ensure MQTT discovery is enabled. The bridge uses discovery to create its Home Assistant entities.
5. Prepare a broker username and password accepted by your broker. Do not use your REHAU tokens as MQTT credentials.
6. Confirm that the bridge can reach the MQTT broker and the Internet. It needs HTTPS access to `accounts.rehau.com` and the REHAU API, plus secure WebSocket access to the REHAU MQTT service on port 443.

If using the Mosquitto add-on, the bridge's usual broker address is `core-mosquitto` and the usual port is `1883`. For an external broker, use its reachable hostname or IP address instead.

> The bridge connects to the Home Assistant MQTT broker before validating REHAU tokens, so it can publish validation errors. If the local MQTT connection fails, fix that connection first; the token-status entity may not appear yet.

## 3. Obtain tokens with the PC-side .NET helper

The [token helper](tools/Rehau.TokenHelper/Program.cs) runs on your PC, not inside Home Assistant. It uses your normal browser for login and .NET for the OAuth code exchange. It needs no Playwright, mailbox access, or third-party NuGet packages.

**Do not open `http://android.neasmart.de/` to obtain tokens.** That address was an Origin/Referer header in the old bridge, not the Playwright login entry point; it returns 404. The helper follows the original script's authorization-code flow with PKCE directly at `accounts.rehau.com`.

### 3.1 Prerequisites and launch

1. Install the **.NET 10 SDK** on your PC (the runtime alone is not enough for `dotnet run`). Confirm that `dotnet --list-sdks` shows a `10.0` SDK.
2. Download or clone this repository, including the `tools\Rehau.TokenHelper` directory.
3. Open PowerShell in the repository root, then run:

   ```powershell
   dotnet run --project .\tools\Rehau.TokenHelper
   ```

   From another directory, supply the full path instead:

   ```powershell
   dotnet run --project C:\source\public\rehau-nea-smart-2-home-assistant\tools\Rehau.TokenHelper
   ```

4. The first run builds the console application and may restore SDK framework assets. It does not install browser automation or request your REHAU credentials.
5. The helper prints a generated login URL and tries to open it in your default browser. If the browser does not open, copy that URL into your browser manually.

Leave the terminal and helper running until the exchange finishes. Each run generates a fresh PKCE verifier, challenge, nonce, and OAuth state; a redirect from one run cannot be used in another run.

### 3.2 Sign in in your browser

1. Verify that the login page is on **`https://accounts.rehau.com`**. The generated entry point is `/authz-srv/authz`, using the original NEA SMART client ID and offline-access scope.
2. Sign in with the REHAU account that owns or can access your installation.
3. If asked for email verification, open your mailbox normally and enter the code in the REHAU page yourself.
4. After successful authorization, the browser redirects to an image URL beginning with:

   ```text
   https://rehau-smartheating-email-gallery-public.s3.eu-central-1.amazonaws.com/publicimages/preprod/rehau.jpg
   ```

5. Copy the **complete final address-bar URL**, including its `?code=...&state=...` query parameters. The page may display an image or an error; the redirect URL, not the image content, is what matters. If it has no `code` and `state`, authorization has not completed successfully for this helper.

No Developer Tools or Network export is necessary. Your password and verification code are entered only on REHAU's browser pages; the helper neither asks for them nor reads your mailbox.

### 3.3 Paste the redirect and obtain the token pair

1. Return to the **same running helper** and paste the complete URL at **Final redirect URL:**. Press Enter promptly, because authorization codes are short-lived and single-use.
2. The helper validates the redirect address and OAuth state, then posts the authorization code and its matching PKCE verifier to:

   ```text
   https://accounts.rehau.com/token-srv/token
   ```

3. If REHAU accepts the exchange, the helper displays:

   ```text
   rehau_access_token: COMPLETE_ACCESS_TOKEN_VALUE
   rehau_refresh_token: COMPLETE_REFRESH_TOKEN_VALUE
   ```

4. Copy only each value into the corresponding Home Assistant token field. Do not include `rehau_access_token:`, `rehau_refresh_token:`, JSON quotes, or a `Bearer ` prefix.
5. Use the email of the browser login as `rehau_email`, then follow sections 4 and 5 to **Save and start/restart** the bridge.
6. Close the terminal and clear your clipboard after configuration. The helper does not write a token file, but tokens are visible in terminal scrollback and any terminal recording.

The authorization code is not an access token: paste the redirect into the helper, not into Home Assistant. Do not substitute an ID token, masked placeholder, or a token from the local Web UI login.

**Treat the redirect URL and both tokens like passwords.** Do not share terminal transcripts, Network/HAR exports, complete configuration, or the persisted token store.

### 3.4 Helper errors and offline checks

- **State mismatch / wrong redirect:** paste the complete image redirect from the login URL printed by this exact helper run. Do not remove `state`, paste only the code, or reuse a previous session's redirect.
- **HTTP 400/401:** the code may have expired or already been consumed. Run the helper again and complete a fresh login; do not retry the same code.
- **HTTP 403 or browser-session protection:** the old Playwright implementation exchanged the code within its browser session. This helper uses a separate .NET HTTP client with no browser cookies. If REHAU requires that browser context or blocks the client, the exchange can fail. It does not disable TLS checks, export cookies, or bypass browser protection. Record only the HTTP status, not secret-bearing responses, for diagnosis.
- **Network/TLS failure or timeout:** check Internet access and system time. The exchange times out after 30 seconds. Start a fresh helper session after resolving the issue.
- **No refresh token in the response:** the helper rejects an incomplete pair. Do not configure the add-on with an access token alone.
- **Cancel:** press Ctrl+C. Nothing is saved; start a new session when ready.

To verify the helper's PKCE, redirect validation, token exchange payload, and response handling without logging in or contacting REHAU:

```powershell
dotnet run --project .\tools\Rehau.TokenHelper -- --self-test
```

For help:

```powershell
dotnet run --project .\tools\Rehau.TokenHelper -- --help
```

Live REHAU login is not covered by these offline checks. Confirm acquisition and add-on startup against your account before relying on unattended operation.

## 4. Fill in the Home Assistant add-on configuration

1. Open **Settings → Add-ons → REHAU NEA SMART 2.0 MQTT Bridge**.
2. Select **Configuration**.
3. Enter the required values:

   | Field | What to enter |
   |---|---|
   | `rehau_email` | The exact REHAU account email used for the browser login |
   | `rehau_access_token` | The complete access-token value copied from the response |
   | `rehau_refresh_token` | The complete refresh-token value from the same response |
   | `mqtt_host` | `core-mosquitto` for the usual Mosquitto add-on, or your broker address |
   | `mqtt_port` | Usually `1883` |
   | `mqtt_user` | The username accepted by your MQTT broker |
   | `mqtt_password` | That MQTT user's password |

4. Both REHAU token fields are password-style inputs and are masked in the form. Enter the actual token strings, not the visible masking characters.
5. Set a strong, separate `api_password` if keeping the Web UI or REST API enabled. Choose an `api_username`; the default username is `admin`.
6. Set `jwt_secret` to a long random secret. It signs local Web UI/API sessions and is unrelated to REHAU tokens. Do not leave the local admin password or signing secret at their fallback defaults.
7. Leave the remaining options at their defaults for initial setup.

### Example configuration

These are placeholders, not working credentials. Replace them locally; do not commit a filled-in copy.

```yaml
rehau_email: "your.email@example.com"
rehau_access_token: "PASTE_COMPLETE_ACCESS_TOKEN_HERE"
rehau_refresh_token: "PASTE_COMPLETE_REFRESH_TOKEN_HERE"
mqtt_host: "core-mosquitto"
mqtt_port: 1883
mqtt_user: "your_mqtt_user"
mqtt_password: "YOUR_MQTT_PASSWORD"
api_enabled: true
web_ui_enabled: true
api_port: 3000
api_username: "admin"
api_password: "YOUR_SEPARATE_STRONG_ADMIN_PASSWORD"
jwt_secret: "YOUR_LONG_RANDOM_SIGNING_SECRET"
log_level: "info"
zone_reload_interval: 300
live_data_interval: 300
token_refresh_interval: 21600
referentials_reload_interval: 86400
```

If your broker deliberately allows anonymous access, both MQTT credential fields can be empty. If a username is supplied, a password is required by the bridge's configuration validator.

Keep `api_port` at `3000` for the standard Home Assistant ingress setup; the add-on ingress configuration expects that port.

### Upgrading from password/POP3 configuration

In the token-only version, remove obsolete REHAU password, `pop3_*`, `pop3_oauth2_*`, `playwright_*`, and forced-login/testing options from any copied YAML configuration. Replace the former REHAU login configuration with the email and token pair above. Keep your MQTT and local administrator credentials.

## 5. Save, start or restart, and validate

1. Click **Save** in the Configuration tab.
2. For first setup, open **Info** and click **Start**. If the add-on is already running, click **Restart**.
3. Open the add-on's **Log** tab.
4. Look for the startup message indicating token authentication, then **Validating REHAU tokens...**.

**Saving alone does not reload the running process or test the new tokens.** Start or restart is the quick validation step. There is no separate “Validate token” button in this implementation.

At startup, the bridge:

1. Checks required configuration values.
2. Connects to the Home Assistant MQTT broker and publishes diagnostic discovery information.
3. Exchanges the refresh token for a fresh token pair over HTTPS, checking that the response is usable.
4. Loads user data with the resulting access token to validate cloud access and discover installations.
5. Connects to REHAU MQTT and initializes installation data and entities.

Individual token-renewal and user-data requests have a 15-second timeout. Overall startup can take longer because MQTT connection and installation initialization are additional steps.

A successful token check produces **Token validation successful** in the log. It should be followed by a count of installations and normal MQTT/installation initialization messages.

### Inspect the diagnostic entity

In Home Assistant, open **Developer tools → States** and search for **REHAU Token Status**, normally `sensor.rehau_token_status`. You can also find it under the **REHAU NEA SMART Bridge** device in the MQTT integration. Home Assistant may assign a different entity ID if an ID already exists or you rename the entity.

| State | Meaning |
|---|---|
| `validating` | Checking the token-backed cloud session |
| `refreshing` | Requesting renewed tokens |
| `authenticated` | Token operation succeeded; startup also checks user-data access |
| `failed` | Validation or renewal failed |

The entity exposes:

- **`error`**: `true` for failure, `false` when no token error is currently reported.
- **`error_text`**: A sanitized explanation on failure, otherwise an empty string.

During startup the state can briefly become `authenticated` after renewal, then `validating` while user data is loaded. Wait for the final validation result and normal bridge initialization rather than relying on a transient state.

A token-status success does not, by itself, prove that REHAU MQTT or every installation initialized successfully. Also check the log, Bridge Status, and the expected climate entities.

### Final acceptance checklist

- [ ] The log reports successful token validation.
- [ ] The expected installation count is present.
- [ ] The token-status entity has `error: false` and empty `error_text`.
- [ ] Bridge Status becomes `connected` after initialization.
- [ ] Expected zone/climate entities appear through MQTT discovery.
- [ ] Temperatures and other states update.
- [ ] If using the Web UI, it opens and accepts the separate local administrator login.

## 6. What happens after configuration

### Automatic renewal

The bridge renews tokens without browser or mailbox access. For tokens with an expiry, it normally schedules renewal five minutes before expiry, or sooner if the configured maximum renewal interval is reached. `token_refresh_interval` defaults to `21600` seconds (six hours); it is an upper bound, not a reason to wait past expiry.

There is normally no need to paste a new access token every time it expires. The refresh token supplies subsequent renewals. Keep the default intervals until the basic setup is working.

### Durable token storage

Renewal can rotate the refresh token as well as the access token. The bridge stores the latest pair in:

```text
/data/rehau-tokens.json
```

For the add-on, this is inside its persistent data directory. For Docker, persist `/data` explicitly as described below.

The configured token fields are not rewritten after each renewal. When the configured email and token pair remain unchanged, a restart loads the latest stored pair rather than overwriting it with the original configured values. Changing the email or either configured token makes that configuration override the previous stored pair.

Protect the token file and add-on backups like credentials. Do not delete the token store as routine maintenance: the originally pasted refresh token may no longer work after rotation.

## 7. Replace rejected tokens or recover from failure

### Temporary network failure

Validation and renewal failures set `error` to `true` and populate `error_text`. Failed renewals retry after approximately 60 seconds. Startup token validation also retries after approximately 60 seconds instead of silently continuing with an unauthenticated session.

Check DNS, Internet access, REHAU availability, and the add-on log. A network error does not automatically mean the refresh token has been revoked. After successful recovery, the error attributes clear.

### REHAU rejects the refresh token

If the log/status shows a persistent HTTP rejection, particularly HTTP 400 or 401:

1. Repeat the manual browser login in section 3.
2. Obtain a **new access token and refresh token from the same response**.
3. Replace **both** token fields in the add-on Configuration tab.
4. Confirm the REHAU email matches that login.
5. Click **Save**, then **Restart**.
6. Repeat the validation checklist.

There is no fallback password login. Leaving the add-on running with a permanently rejected refresh token only causes retries; it cannot complete an interactive login for you.

### Common symptoms

| Symptom | Checks and corrective action |
|---|---|
| Required-value error before startup | Fill email and both tokens. Check for empty strings or whitespace. Save and start/restart. |
| No token-status entity | Check local MQTT connection, Home Assistant MQTT integration, discovery, and whether the entity is disabled. Early configuration failure can occur before discovery is published. |
| Token request absent from browser Network list | Open Developer Tools before login, enable Preserve log, verify recording, clear filters or choose All requests, and repeat login. |
| Token response lacks a refresh token | Verify that this is the NEA SMART token exchange response, not another portal or admin login. Do not substitute an ID token or code. |
| Persistent HTTP 401 during validation/renewal | Verify account/email and complete tokens; obtain a new pair if rejected. |
| HTTP 403 or no expected installations | Check account access/sharing permissions. Correct the account rather than repeatedly changing polling intervals. |
| Tokens validate, but entities never initialize | Check installation count, REHAU MQTT connection, and subsequent startup errors. |
| Entities stopped updating after losing/replacing a container | Confirm persistent `/data` storage was retained. If the rotated refresh token was lost, obtain a new pair. |
| Local Web UI rejects login | Use `api_username` and `api_password`, not REHAU credentials. |
| Changes appear ignored | Save and restart. The Web UI Settings page shows configuration but is not the token-editing form. |

## 8. Optional settings after successful setup

| Option | Default | Guidance |
|---|---|---|
| `zone_reload_interval` | `300` seconds | Periodic installation/zone HTTP reload. Lower values increase cloud traffic. |
| `live_data_interval` | `300` seconds | Live-data polling. Keep at least `60` seconds; the runtime validator enforces that minimum. |
| `token_refresh_interval` | `21600` seconds | Maximum renewal interval; expiry-aware scheduling may run earlier. |
| `referentials_reload_interval` | `86400` seconds | Reload reference data once per day by default. |
| `log_level` | `info` | Use `debug` temporarily for diagnosis; review logs before sharing. |
| `use_group_in_names` | `false` | Include installation group names in displayed entity names when enabled. |
| `command_retry_timeout` | `30` seconds | Time allowed for command retry handling. |
| `command_max_retries` | `3` | Maximum command retries. |
| `api_enabled`, `web_ui_enabled` | `true` | Keep the local API and Web UI enabled initially. The Web UI needs the API. Disable both if neither is needed. |

See the [configuration guide](docs/configuration.md) for additional parameters. Avoid changing monitoring thresholds or command retry settings to conceal authentication or connectivity errors.

## 9. Docker and standalone configuration

The token acquisition and validation procedure is the same outside the Supervisor. Instead of the add-on form, supply environment variables to the bridge:

```dotenv
REHAU_EMAIL=your.email@example.com
REHAU_ACCESS_TOKEN=PASTE_COMPLETE_ACCESS_TOKEN_HERE
REHAU_REFRESH_TOKEN=PASTE_COMPLETE_REFRESH_TOKEN_HERE
REHAU_TOKEN_STORE_PATH=/data/rehau-tokens.json
MQTT_HOST=your-broker-hostname
MQTT_PORT=1883
MQTT_USER=your_mqtt_user
MQTT_PASSWORD=YOUR_MQTT_PASSWORD
API_USERNAME=admin
API_PASSWORD=YOUR_SEPARATE_STRONG_ADMIN_PASSWORD
JWT_SECRET=YOUR_LONG_RANDOM_SIGNING_SECRET
```

Use the [environment template](rehau-nea-smart-mqtt-bridge/.env.example) for the complete option list.

- Configure Home Assistant's MQTT integration against the same broker the bridge publishes to.
- In a container, `localhost` means that container, not the host or another broker container. Use a reachable host address or the broker's service name on a shared Docker network.
- Attach a named volume or persistent bind mount at `/data`. A Compose volume mapping such as `rehau-data:/data` keeps rotated tokens across container recreation; declare the named volume in your Compose configuration.
- Protect any environment file; do not commit real credentials.
- After changing container environment values, recreate the container with the updated configuration. Merely restarting an existing container does not apply edited Compose environment values or an edited `env_file`.
- For a directly run Node process, set `REHAU_TOKEN_STORE_PATH` to a persistent writable location and restart the process after updating its environment. Without a configured store path, direct execution does not persist rotated tokens.

Consult the [installation guide](docs/installation.md) for deployment details. A live end-to-end REHAU login and Docker image build were not performed when these token-only changes were implemented; test your deployment against the acceptance checklist before relying on it unattended.
