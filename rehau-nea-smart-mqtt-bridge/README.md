# REHAU NEA SMART 2.0 MQTT Bridge

<div align="center">

![Version](https://img.shields.io/badge/Version-5.1.9-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg?logo=node.js)
![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)
![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg?logo=docker)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)
![MQTT](https://img.shields.io/badge/MQTT-5.0-brightgreen.svg)

**Enterprise-grade MQTT bridge with modern web interface for REHAU NEA SMART 2.0 heating systems**

[Features](#-features) • [Installation](#-installation) • [Configuration](#-configuration) • [API Docs](#-api-documentation) • [Troubleshooting](#-troubleshooting)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Screenshots](#-screenshots)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [API Documentation](#-api-documentation)
- [Web UI](#-web-ui)
- [Home Assistant Integration](#-home-assistant-integration)
- [Troubleshooting](#-troubleshooting)
- [Development](#-development)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

The REHAU NEA SMART 2.0 MQTT Bridge is a professional-grade integration solution that connects REHAU heating systems to Home Assistant and other MQTT-based platforms. Built with TypeScript and modern web technologies, it provides:

- **Real-time MQTT Bridge** - Bidirectional communication with REHAU cloud services
- **Modern Web UI** - Progressive Web App with mobile-first responsive design
- **REST API** - Complete programmatic access with OpenAPI/Swagger documentation
- **Token Authentication** - Supplied access/refresh tokens with expiry-aware renewal
- **Enterprise Features** - Monitoring, logging, health checks, and more

### Architecture

```
┌─────────────────┐      HTTPS/WSS      ┌──────────────┐
│  REHAU Cloud    │◄────────────────────┤ Token HTTPS  │
│   API / MQTT   │                     │    Client    │
└─────────────────┘                     └──────┬───────┘
                                               │
                                        ┌──────▼───────┐
                                        │  MQTT Bridge │
                                        │  (Node.js)   │
                                        └──────┬───────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
             ┌──────▼───────┐          ┌──────▼───────┐          ┌──────▼───────┐
             │  MQTT Broker │          │   REST API   │          │   Web UI     │
             │ (Mosquitto)  │          │  (Express)   │          │   (React)    │
             └──────┬───────┘          └──────────────┘          └──────────────┘
                    │
             ┌──────▼───────┐
             │Home Assistant│
             │  (MQTT Auto  │
             │   Discovery) │
             └──────────────┘
```

---

## ✨ Features

### Core Functionality

#### MQTT Bridge
- ✅ **Real-time Synchronization** - Instant updates via MQTT protocol
- ✅ **Bidirectional Communication** - Read and control all zones
- ✅ **Automatic Reconnection** - Resilient connection management
- ✅ **QoS Support** - Reliable message delivery
- ✅ **Retained Messages** - State persistence across restarts

#### Authentication & Security
- ✅ **Token Management** - Automatic renewal before expiry and durable storage
- ✅ **JWT Authentication** - Secure API access
- ✅ **Password Hashing** - bcrypt-based credential storage

#### Web Interface
- 📱 **Progressive Web App** - Install on any device
- 🎨 **Modern Design** - Material-inspired responsive UI
- 🌓 **Dark Mode** - Automatic theme switching
- 📊 **Real-time Dashboard** - Live system monitoring
- 🔐 **Secure Login** - JWT-based authentication
- 📱 **Mobile Optimized** - Touch-friendly controls
- 🔄 **Pull-to-Refresh** - Native mobile gestures
- 📴 **Offline Support** - Service worker caching

#### REST API
- 🔌 **OpenAPI 3.0** - Complete Swagger documentation
- 🔐 **Bearer Authentication** - JWT token-based access
- 📊 **System Status** - Health checks and diagnostics
- 🏠 **Installation Management** - Full CRUD operations
- 🌡️ **Zone Control** - Temperature and mode management
- 📝 **Log Export** - Obfuscated log downloads
- 📈 **Statistics** - Usage and performance metrics

#### Monitoring & Diagnostics
- 🔍 **Staleness Detection** - Automatic data freshness monitoring
- 📈 **Resource Monitoring** - CPU and memory tracking
- 📝 **Enhanced Logging** - Structured, obfuscated logs
- 🏥 **Health Checks** - System diagnostics endpoint
- 📊 **Performance Metrics** - Response time tracking
- 🔔 **Alert System** - Configurable notifications

#### Advanced Features
- 🔄 **Data Validation** - Schema-based input validation
- 🗄️ **State Management** - Persistent zone states
- 🔌 **Plugin Architecture** - Extensible design
- 🌐 **Multi-language** - Internationalization ready
- 📦 **Docker Support** - Production-ready containers
- 🚀 **Auto-scaling** - Horizontal scaling support

---

## 📸 Screenshots

### Mobile Web UI (iPhone 14 Pro)

<div align="center">

#### Dashboard
![Dashboard](./docs/screenshots/02-dashboard.png)

*Real-time system overview with status indicators and quick stats*

#### Zones List
![Zones](./docs/screenshots/03-zones.png)

*All heating zones with current temperature and status*

#### Zone Detail
![Zone Detail](./docs/screenshots/04-zone-detail.png)

*Detailed zone control with temperature adjustment and mode selection*

#### System Status
![System](./docs/screenshots/05-system.png)

*System diagnostics, resource usage, and configuration*

#### Login
![Login](./docs/screenshots/01-login.png)

*Secure authentication with modern design*

</div>

---

## 🚀 Installation

### Prerequisites

- **Node.js** 20.x or higher
- **MQTT Broker** (Mosquitto recommended)
- **REHAU Account** with NEA SMART 2.0 system
- **Access and refresh tokens** obtained by manual browser login (see below)

### Option 1: Home Assistant Add-on (Recommended)

1. **Add Repository**
   ```
   https://github.com/manuxio/rehau-nea-smart-2-home-assistant
   ```

2. **Install Add-on**
   - Settings → Add-ons → Add-on Store
   - Search for "REHAU NEA SMART 2.0"
   - Click Install

3. **Configure** (see [Configuration](#-configuration))

4. **Start**
   - Enable "Start on boot"
   - Enable "Watchdog"
   - Click Start

### Option 2: Docker

```bash
# Pull image
docker pull ghcr.io/manuxio/rehau-nea-smart-2-home-assistant:latest

# Run container
docker run -d \
  --name rehau-bridge \
  --restart unless-stopped \
  -p 3000:3000 \
  -e REHAU_EMAIL=your@email.com \
  -e REHAU_ACCESS_TOKEN=your_access_token \
  -e REHAU_REFRESH_TOKEN=your_refresh_token \
  -v rehau-data:/data \
  -e MQTT_HOST=mqtt-broker \
  -e MQTT_PORT=1883 \
  -e MQTT_USERNAME=mqtt_user \
  -e MQTT_PASSWORD=mqtt_pass \
  -e API_PASSWORD=secure_password \
  ghcr.io/manuxio/rehau-nea-smart-2-home-assistant:latest
```

### Option 3: Docker Compose

```yaml
version: '3.8'

services:
  rehau-bridge:
    image: ghcr.io/manuxio/rehau-nea-smart-2-home-assistant:latest
    container_name: rehau-bridge
    restart: unless-stopped
    volumes:
      - rehau-data:/data
    ports:
      - "3000:3000"
    environment:
      # REHAU Credentials
      REHAU_EMAIL: your@email.com
      REHAU_ACCESS_TOKEN: your_access_token
      REHAU_REFRESH_TOKEN: your_refresh_token

      # MQTT Configuration
      MQTT_HOST: mosquitto
      MQTT_PORT: 1883
      MQTT_USER: mqtt_user
      MQTT_PASSWORD: mqtt_pass

      # API Configuration
      API_ENABLED: true
      API_PASSWORD: secure_password
      WEB_UI_ENABLED: true

      # Logging
      LOG_LEVEL: info
    depends_on:
      - mosquitto

  mosquitto:
    image: eclipse-mosquitto:latest
    container_name: mosquitto
    restart: unless-stopped
    ports:
      - "1883:1883"
    volumes:
      - ./mosquitto/config:/mosquitto/config
      - ./mosquitto/data:/mosquitto/data
      - ./mosquitto/log:/mosquitto/log

volumes:
  rehau-data:
```

### Option 4: Standalone

```bash
# Clone repository
git clone https://github.com/manuxio/rehau-nea-smart-2-home-assistant.git
cd rehau-nea-smart-2-home-assistant/rehau-nea-smart-mqtt-bridge

# Install dependencies
npm install

# Configure
cp .env.example .env
# Edit .env with your credentials

# Build
npm run build

# Start
npm start
```

---

## ⚙️ Configuration

See the [Configuration Guide](../docs/configuration.md) and [.env.example](./.env.example) for all options. Set your MQTT broker and a strong **separate** API/Web UI administrator password and JWT secret.

## 🔐 Obtain REHAU Tokens

The bridge requires your REHAU account email and **both** an access token and a refresh token. It never logs into REHAU with a password or reads your mailbox. The separate local API/Web UI administrator login is unchanged.

Use the PC-side **.NET 10 token helper** described in the [configuration manual](../manual.md#3-obtain-tokens-with-the-pc-side-net-helper). From the repository root, run:

```powershell
dotnet run --project .\tools\Rehau.TokenHelper
```

The helper opens a generated REHAU OAuth login URL. Sign in and complete email verification in your own browser, then paste the full final image redirect URL into the same running helper. It exchanges the code using PKCE and displays both tokens. Copy the token values into Home Assistant, set the matching account email, Save, and start/restart to validate them. It does not require Playwright or mailbox credentials and writes no token file.

Do not use http://android.neasmart.de/ as a login page: it was only an Origin/Referer header in the original client. No Network export is needed. The helper's live exchange may be rejected if REHAU requires browser-session protection; see the manual for limitations and troubleshooting.

Renewal is scheduled **before access-token expiry**, bounded by `token_refresh_interval`. Rotated tokens are saved durably in **`/data/rehau-tokens.json`**, so unchanged configured tokens do not overwrite the latest renewed pair on restart. Mount a persistent `/data` volume in Docker; standalone deployments can set `REHAU_TOKEN_STORE_PATH` to a persistent writable path. Protect this file like a password and keep it with backups of your add-on data.

The diagnostic sensor exposes `error` (boolean) and `error_text` (sanitized explanation). If validation or renewal fails, check these attributes and your network connection. If REHAU rejects the refresh token, obtain a **new pair**, replace both fields, Save, and restart. The bridge does not fall back to password/browser login. Never share tokens, the token store, or Network/HAR exports.

---

## 📡 API Documentation

### Swagger UI

Access interactive API documentation at:
```
http://localhost:3000/api-docs
```

### Authentication

All API endpoints (except `/health`) require JWT authentication:

```bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'

# Response
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h"
}

# Use token in subsequent requests
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/status/system
```

### Key Endpoints

#### System Status
```bash
GET /api/v1/status/system
```

#### Installations
```bash
GET /api/v1/installations
GET /api/v1/installations/:id
```

#### Zones
```bash
GET /api/v1/zones
GET /api/v1/zones/:id
POST /api/v1/zones/:id/temperature
POST /api/v1/zones/:id/mode
```

#### Logs
```bash
GET /api/v1/logs
GET /api/v1/logs/export?mode=shareable
```

#### Configuration
```bash
GET /api/v1/config
```

---

## 🌐 Web UI

### Access

- **URL**: `http://localhost:3000`
- **Default Credentials**: `admin` / (your API_PASSWORD)

### Features

- **Dashboard** - System overview and quick stats
- **Zones** - All heating zones with real-time data
- **Zone Control** - Temperature adjustment and mode selection
- **System** - Diagnostics, logs, and configuration
- **Settings** - User preferences and about information

### Progressive Web App

Install as a native app on any device:

**iOS (Safari)**:
1. Open in Safari
2. Tap Share → Add to Home Screen

**Android (Chrome)**:
1. Open in Chrome
2. Tap Menu → Install app

**Desktop (Chrome/Edge)**:
1. Click install icon in address bar
2. Click Install

---

## 🏠 Home Assistant Integration

### Auto-Discovery

The bridge automatically creates MQTT discovery entities:

#### Climate Entities
```yaml
climate.rehau_living_room:
  current_temperature: 21.5
  target_temperature: 22.0
  hvac_mode: heat
  preset_mode: comfort
  hvac_modes: [heat, cool, off]
  preset_modes: [comfort, eco, away, home]
```

#### Sensors
- `sensor.rehau_bridge_status` - Connection status
- `sensor.rehau_token_status` - Token validation/renewal, `error` and `error_text` attributes
- `sensor.rehau_auth_status` - Authentication state
- `sensor.rehau_outside_temperature` - Outdoor temperature
- `sensor.rehau_zone_*_humidity` - Zone humidity

#### Binary Sensors
- `binary_sensor.rehau_zone_*_stale` - Data freshness

### Example Automations

**Night Mode**:
```yaml
automation:
  - alias: "REHAU Night Mode"
    trigger:
      platform: time
      at: "22:00:00"
    action:
      service: climate.set_preset_mode
      target:
        entity_id: climate.rehau_bedroom
      data:
        preset_mode: eco
```

---

## 🔧 Troubleshooting

### Token Validation or Renewal Issues

Check `sensor.rehau_token_status` attributes `error` and `error_text` and the add-on log. Verify your account email, both tokens, and network access. For a rejected refresh token obtain a new pair, Save, and restart. Do not share raw tokens or browser Network exports.

### MQTT Issues

**Problem**: MQTT connection fails
```
✓ Verify broker is running
✓ Check MQTT_HOST and MQTT_PORT
✓ Test with mosquitto_pub/sub
✓ Verify credentials if auth enabled
✓ Check firewall rules
```

### Data Staleness

**Problem**: Zone data not updating
```
✓ Check staleness sensors
✓ Verify MQTT connection quality
✓ Review authentication status
✓ Check LIVE_DATA_INTERVAL setting
✓ Manually trigger refresh via API
```

### Debug Mode

Enable detailed logging:
```env
LOG_LEVEL=debug
LOG_SHOW_OK_REQUESTS=true
```

View logs:
```bash
# Docker
docker logs rehau-bridge -f

# Standalone
npm start
```

---

## 👨‍💻 Development

### Setup

```bash
git clone https://github.com/manuxio/rehau-nea-smart-2-home-assistant.git
cd rehau-nea-smart-2-home-assistant/rehau-nea-smart-mqtt-bridge

npm install
cp .env.example .env
# Edit .env

npm run dev
```

### Scripts

```bash
npm run build          # Build backend + web UI
npm run build:backend  # Build TypeScript
npm run build:web-ui   # Build React app
npm start              # Start production server
npm run dev            # Start development server
npm test               # Run tests
npm run release:patch  # Bump patch version
npm run release:minor  # Bump minor version
npm run release:major  # Bump major version
```

### Project Structure

```
rehau-nea-smart-mqtt-bridge/
├── src/
│   ├── api/              # REST API routes and middleware
│   ├── ha-integration/   # Home Assistant integration
│   ├── logging/          # Enhanced logging system
│   ├── monitoring/       # Resource and staleness monitoring
│   ├── parsers/          # REHAU data parsers
│   ├── climate-controller.ts
│   ├── index.ts
│   ├── mqtt-bridge.ts
│   └── rehau-auth.ts
├── web-ui/
│   ├── src/
│   │   ├── api/          # API client
│   │   ├── components/   # React components
│   │   ├── contexts/     # React contexts
│   │   ├── hooks/        # Custom hooks
│   │   ├── pages/        # Page components
│   │   └── store/        # Zustand state management
│   └── public/
├── docs/                 # Documentation
├── scripts/              # Build and release scripts
└── tests/                # Test files
```

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Style

- **TypeScript** with strict mode
- **ESLint** for linting
- **Prettier** for formatting
- **Conventional Commits** for commit messages

---

## 📄 License

MIT License - See [LICENSE](../LICENSE) for details.

---

## 🙏 Acknowledgments

### Sponsors

This project is proudly sponsored by **[DomoDreams.it](https://domodreams.it)** - Your trusted partner for smart home solutions.

### Contributors

- **REHAU** for the NEA SMART 2.0 system
- **Home Assistant** community
- **React** and **TypeScript** communities
- All contributors and users

---

<div align="center">

**Version 5.1.5** | **Made with ❤️ for Home Assistant**

[⬆ Back to Top](#rehau-nea-smart-20-mqtt-bridge)

</div>
