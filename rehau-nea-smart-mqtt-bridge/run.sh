#!/bin/sh
set -eu

OPTIONS_FILE="/data/options.json"
if [ -f "$OPTIONS_FILE" ]; then
  if ! command -v jq >/dev/null 2>&1; then
    echo "[ERROR] jq is required to read add-on options."
    exit 1
  fi
  if ! jq -e 'type == "object"' "$OPTIONS_FILE" >/dev/null; then
    echo "[ERROR] Add-on options must be a valid JSON object."
    exit 1
  fi

  # Export values without logging secrets; preserve explicit false settings.
  for key in rehau_email rehau_access_token rehau_refresh_token mqtt_host mqtt_port mqtt_user mqtt_password api_enabled web_ui_enabled api_port api_username api_password jwt_secret log_level log_show_ok_requests zone_reload_interval token_refresh_interval referentials_reload_interval live_data_interval command_retry_timeout command_max_retries disable_redundant_commands use_group_in_names memory_warning_mb staleness_warning_ms staleness_stale_ms; do
    value="$(jq -r --arg key "$key" 'if .[$key] == null then empty else .[$key] end' "$OPTIONS_FILE")"
    variable="$(printf '%s' "$key" | tr '[:lower:]' '[:upper:]')"
    export "$variable=$value"
  done
fi

: "${MQTT_PORT:=1883}"
: "${API_ENABLED:=true}"
: "${WEB_UI_ENABLED:=true}"
: "${API_PORT:=3000}"
: "${API_USERNAME:=admin}"
: "${LOG_LEVEL:=info}"
: "${LOG_SHOW_OK_REQUESTS:=false}"
: "${ZONE_RELOAD_INTERVAL:=300}"
: "${TOKEN_REFRESH_INTERVAL:=21600}"
: "${REFERENTIALS_RELOAD_INTERVAL:=86400}"
: "${LIVE_DATA_INTERVAL:=300}"
: "${COMMAND_RETRY_TIMEOUT:=30}"
: "${COMMAND_MAX_RETRIES:=3}"
: "${DISABLE_REDUNDANT_COMMANDS:=true}"
: "${USE_GROUP_IN_NAMES:=false}"
: "${MEMORY_WARNING_MB:=150}"
: "${STALENESS_WARNING_MS:=600000}"
: "${STALENESS_STALE_MS:=1800000}"
: "${API_PASSWORD:=admin}"
: "${JWT_SECRET:=change-this-secret-in-production}"
: "${REHAU_TOKEN_STORE_PATH:=/data/rehau-tokens.json}"

if [ -z "${REHAU_EMAIL:-}" ] || [ -z "${REHAU_ACCESS_TOKEN:-}" ] || [ -z "${REHAU_REFRESH_TOKEN:-}" ]; then
  echo "[ERROR] REHAU email, access token, and refresh token are all required."
  echo "[ERROR] Obtain both tokens by manual NEA SMART browser login, Save configuration, and restart."
  exit 1
fi
if [ -z "${MQTT_HOST:-}" ]; then
  echo "[ERROR] MQTT_HOST is required."
  exit 1
fi

export REHAU_EMAIL REHAU_ACCESS_TOKEN REHAU_REFRESH_TOKEN MQTT_HOST MQTT_PORT MQTT_USER MQTT_PASSWORD API_ENABLED WEB_UI_ENABLED API_PORT API_USERNAME API_PASSWORD JWT_SECRET LOG_LEVEL LOG_SHOW_OK_REQUESTS ZONE_RELOAD_INTERVAL TOKEN_REFRESH_INTERVAL REFERENTIALS_RELOAD_INTERVAL LIVE_DATA_INTERVAL COMMAND_RETRY_TIMEOUT COMMAND_MAX_RETRIES DISABLE_REDUNDANT_COMMANDS USE_GROUP_IN_NAMES MEMORY_WARNING_MB STALENESS_WARNING_MS STALENESS_STALE_MS REHAU_TOKEN_STORE_PATH

# The backend validates tokens immediately and persists subsequent renewals here.
mkdir -p "$(dirname "$REHAU_TOKEN_STORE_PATH")"
cd /app
echo "[INFO] Starting REHAU bridge with token authentication."
exec node dist/index.js
