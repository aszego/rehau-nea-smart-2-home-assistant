# Configuration Guide

This guide covers configuration for both Home Assistant OS (Add-on) and Home Assistant Core (Docker).

## Home Assistant OS Add-on Configuration

Configure via the add-on's **Configuration** tab in Home Assistant:

### Required Settings

```yaml
rehau_email: your.email@example.com
rehau_access_token: your_access_token
rehau_refresh_token: your_refresh_token
mqtt_host: core-mosquitto
mqtt_port: 1883
mqtt_user: mqtt_user
mqtt_password: mqtt_password
```

### Optional Settings

```yaml
api_port: 3000                          # REST API port (default: 3000)
log_level: info                         # debug|info|warn|error (default: info)
zone_reload_interval: 300               # Seconds between HTTPS polls (default: 300, max: 86400)
token_refresh_interval: 21600           # Maximum renewal interval; expiry-aware scheduling may renew earlier
referentials_reload_interval: 86400     # Seconds between referentials reload (default: 86400)
use_group_in_names: false               # Include group in display names (default: false)
```

---

## Home Assistant Core Configuration

Configure via environment variables (see `.env.example` for template):

### Required Environment Variables

```bash
REHAU_EMAIL=your.email@example.com
REHAU_ACCESS_TOKEN=your_access_token
REHAU_REFRESH_TOKEN=your_refresh_token
REHAU_TOKEN_STORE_PATH=/data/rehau-tokens.json
MQTT_HOST=localhost  # or your MQTT broker hostname/IP
MQTT_PORT=1883
```

### Optional Environment Variables

```bash
API_PORT=3000
LOG_LEVEL=info
ZONE_RELOAD_INTERVAL=300
TOKEN_REFRESH_INTERVAL=21600
REFERENTIALS_RELOAD_INTERVAL=86400
USE_GROUP_IN_NAMES=false
```

---

## Configuration Parameters Explained

### REHAU Tokens

- **REHAU_EMAIL / rehau_email**: Your REHAU NEA SMART account email address
- **REHAU_ACCESS_TOKEN / rehau_access_token**: Required access token (masked in Home Assistant)
- **REHAU_REFRESH_TOKEN / rehau_refresh_token**: Required refresh token from the same login response (masked)
- **REHAU_TOKEN_STORE_PATH**: Durable token file; Docker/add-on default `/data/rehau-tokens.json`

### Obtaining the Token Pair

The bridge requires your REHAU account email and **both** an access token and a refresh token. It never logs into REHAU with a password or reads your mailbox. The separate local API/Web UI administrator login is unchanged.

Use the PC-side **.NET 10 token helper** described in the [configuration manual](../manual.md#3-obtain-tokens-with-the-pc-side-net-helper). From the repository root, run:

```powershell
dotnet run --project .\tools\Rehau.TokenHelper
```

The helper opens a generated REHAU OAuth login URL. Sign in and complete email verification in your own browser, then paste the full final image redirect URL into the same running helper. It exchanges the code using PKCE and displays both tokens. Copy the token values into Home Assistant, set the matching account email, Save, and start/restart to validate them. It does not require Playwright or mailbox credentials and writes no token file.

Do not use http://android.neasmart.de/ as a login page: it was only an Origin/Referer header in the original client. No Network export is needed. The helper's live exchange may be rejected if REHAU requires browser-session protection; see the manual for limitations and troubleshooting.

Renewal is scheduled **before access-token expiry**, bounded by `token_refresh_interval`. Rotated tokens are saved durably in **`/data/rehau-tokens.json`**, so unchanged configured tokens do not overwrite the latest renewed pair on restart. Mount a persistent `/data` volume in Docker; standalone deployments can set `REHAU_TOKEN_STORE_PATH` to a persistent writable path. Protect this file like a password and keep it with backups of your add-on data.

The diagnostic sensor exposes `error` (boolean) and `error_text` (sanitized explanation). If validation or renewal fails, check these attributes and your network connection. If REHAU rejects the refresh token, obtain a **new pair**, replace both fields, Save, and restart. The bridge does not fall back to password/browser login. Never share tokens, the token store, or Network/HAR exports.


### MQTT Configuration

- **MQTT_HOST / mqtt_host**:
  - HA OS: Usually `core-mosquitto` if using the Mosquitto add-on
  - HA Core: Use broker hostname/IP (e.g., `localhost`, `192.168.1.100`, or Docker service name)
- **MQTT_PORT / mqtt_port**: Usually `1883` for non-TLS connections
- **MQTT_USER / mqtt_user**: Required if MQTT broker has authentication enabled
- **MQTT_PASSWORD / mqtt_password**: Required if MQTT broker has authentication enabled

### API Configuration

- **API_PORT / api_port**: Port for the REST API health endpoint (default: `3000`)

### Logging

- **LOG_LEVEL / log_level**: Logging verbosity level
  - `debug`: Detailed logging including MQTT messages and API requests (use with caution)
  - `info`: Standard logging (recommended for production)
  - `warn`: Only warnings and errors
  - `error`: Only errors

### Interval Configuration

- **ZONE_RELOAD_INTERVAL / zone_reload_interval**: How often to poll REHAU API for zone updates (in seconds)
  - Lower values = more frequent updates but more API calls
  - Default: `300` (5 minutes)
  - Maximum: `86400` (24 hours)

- **TOKEN_REFRESH_INTERVAL / token_refresh_interval**: Maximum interval between token renewals (in seconds); expiry-aware scheduling renews earlier when needed
  - Default: `21600` (6 hours)

- **REFERENTIALS_RELOAD_INTERVAL / referentials_reload_interval**: How often to reload referential data (in seconds)
  - Default: `86400` (24 hours)

- **LIVE_DATA_INTERVAL / live_data_interval**: How often to poll for live sensor data (in seconds)
  - Default: `300` (5 minutes)

### Display Configuration

- **USE_GROUP_IN_NAMES / use_group_in_names**: Include group name in entity display names
  - `false`: Entity names will be shorter (e.g., "Living Room")
  - `true`: Entity names will include group (e.g., "Ground Floor - Living Room")
  - Default: `false`

### Command Retry Configuration

- **COMMAND_RETRY_TIMEOUT / command_retry_timeout**: Timeout for command retries (in seconds)
  - Default: `30`

- **COMMAND_MAX_RETRIES / command_max_retries**: Maximum number of retry attempts for failed commands
  - Default: `3`

---

## Configuration Best Practices

1. **Start with defaults**: Most users don't need to change the optional settings
2. **Adjust intervals carefully**: Lower intervals increase API usage and may hit rate limits
3. **Use debug mode sparingly**: Debug logging can be verbose and may expose sensitive information
4. **Secure your credentials**: Never commit `.env` files or configuration with credentials to version control

---

## Related Documentation

- [Installation Guide](./installation.md) - How to install the bridge
- [Troubleshooting Guide](./troubleshooting.md) - Common configuration issues
- [Features Guide](./features.md) - What features are available
