# Docker Build and Run Guide

## Building the Docker Image

### Build Command:

```bash
docker build -t rehau-nea-smart-mqtt-bridge:latest .
```

### Build with specific Node version:

```bash
docker build --build-arg BUILD_FROM=node:20-alpine -t rehau-nea-smart-mqtt-bridge:latest .
```

### Multi-platform build (for Home Assistant):

```bash
docker buildx build --platform linux/amd64,linux/arm64,linux/arm/v7 -t rehau-nea-smart-mqtt-bridge:latest .
```

---

## Running the Docker Container

[Obtain both tokens manually](../../docs/configuration.md#obtaining-the-token-pair) and configure the REHAU email, access token, and refresh token. Set a strong separate API/Web UI administrator password and JWT secret in `.env`. Restart after changing tokens for immediate validation. Keep `/data` mounted durably for renewed tokens; inspect `sensor.rehau_token_status` attributes `error`/`error_text` for validation and renewal failures. No browser or mailbox packages are required.

### Standalone Mode (using environment variables):

```bash
docker run -d \
  --name rehau-bridge \
  -p 3000:3000 \
  -v rehau-data:/data \
  -e REHAU_EMAIL="your.email@example.com" \
  -e REHAU_ACCESS_TOKEN="your_access_token" \
  -e REHAU_REFRESH_TOKEN="your_refresh_token" \
  -e MQTT_HOST="192.168.1.100" \
  -e MQTT_PORT="1883" \
  -e MQTT_USER="mqtt_user" \
  -e MQTT_PASSWORD="mqtt_password" \
  -e API_ENABLED="true" \
  -e WEB_UI_ENABLED="true" \
  -e API_PORT="3000" \
  -e LOG_LEVEL="info" \
  rehau-nea-smart-mqtt-bridge:latest
```

### Using .env file:

```bash
docker run -d \
  --name rehau-bridge \
  -p 3000:3000 \
  -v rehau-data:/data \
  --env-file .env \
  rehau-nea-smart-mqtt-bridge:latest
```

### With Docker Compose:

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  rehau-bridge:
    image: rehau-nea-smart-mqtt-bridge:latest
    container_name: rehau-bridge
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - rehau-data:/data
    environment:
      # REHAU Account
      REHAU_EMAIL: "your.email@example.com"
      REHAU_ACCESS_TOKEN: "your_access_token"
      REHAU_REFRESH_TOKEN: "your_refresh_token"

      # MQTT Broker
      MQTT_HOST: "mqtt-broker"
      MQTT_PORT: "1883"
      MQTT_USER: "mqtt_user"
      MQTT_PASSWORD: "mqtt_password"

      # API & Web UI
      API_ENABLED: "true"
      WEB_UI_ENABLED: "true"
      API_PORT: "3000"
      API_USERNAME: "admin"
      API_PASSWORD: "your_secure_password"
      JWT_SECRET: "your_jwt_secret"

      # Logging
      LOG_LEVEL: "info"
      LOG_SHOW_OK_REQUESTS: "false"

    networks:
      - rehau-network
    depends_on:
      - mqtt-broker

  mqtt-broker:
    image: eclipse-mosquitto:latest
    container_name: mqtt-broker
    restart: unless-stopped
    ports:
      - "1883:1883"
    volumes:
      - ./mosquitto/config:/mosquitto/config
      - ./mosquitto/data:/mosquitto/data
      - ./mosquitto/log:/mosquitto/log
    networks:
      - rehau-network

volumes:
  rehau-data:

networks:
  rehau-network:
    driver: bridge
```

Then run:

```bash
docker-compose up -d
```

---

## Accessing the Application

- **Web UI**: http://localhost:3000
- **API Docs**: http://localhost:3000/api-docs
- **Health Check**: http://localhost:3000/health

---

## Environment Variables

See `.env.example` for complete list of environment variables.

### Required:
- `REHAU_EMAIL` - Your REHAU account email
- `REHAU_ACCESS_TOKEN` - Required access token
- `REHAU_REFRESH_TOKEN` - Required refresh token from the same login response
- `MQTT_HOST` - MQTT broker hostname/IP

### Optional (with defaults):
- `MQTT_PORT=1883` - MQTT broker port
- `API_PORT=3000` - API and Web UI port
- `LOG_LEVEL=info` - Logging level
- `PLAYWRIGHT_HEADLESS=true` - Headless browser mode

---

## Troubleshooting

### Check logs:

```bash
docker logs rehau-bridge
```

### Check logs (follow):

```bash
docker logs -f rehau-bridge
```

### Enter container:

```bash
docker exec -it rehau-bridge sh
```

### Check if web UI files exist:

```bash
docker exec rehau-bridge ls -la /app/web-ui/dist
```

### Verify Chromium installation:

```bash
docker exec rehau-bridge chromium --version
```

---

## Home Assistant Addon

For Home Assistant addon, the image is built automatically by Home Assistant using `config.yaml` and `build.yaml`.

The addon uses `/data/options.json` for configuration instead of environment variables.

---

## Notes

- The image uses multi-stage build to minimize size
- Web UI is built during Docker build (not at runtime)
- No browser runtime is included; tokens are renewed over HTTPS
- Health check endpoint is `/health`
- Logs are written to stdout (visible with `docker logs`)
