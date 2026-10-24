# REHAU NEA SMART 2.0 - Home Assistant Integration

<div align="center">

![Version](https://img.shields.io/badge/Version-5.1.9-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg?logo=node.js)
![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg?logo=docker)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)
![Home Assistant](https://img.shields.io/badge/Home%20Assistant-Add--on-orange.svg?logo=home-assistant)
![MQTT](https://img.shields.io/badge/MQTT-Bridge-brightgreen.svg)

**Professional MQTT bridge and web interface for REHAU NEA SMART 2.0 heating systems**

[Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Screenshots](#-screenshots) • [Support](#-support)

</div>

---

## 📋 Overview

This project provides a complete integration solution for REHAU NEA SMART 2.0 heating systems with Home Assistant. It features:

- **MQTT Bridge** - Real-time bidirectional communication with REHAU cloud
- **Modern Web UI** - Progressive Web App with mobile-first design
- **REST API** - Complete programmatic access with Swagger documentation
- **Token Authentication** - Manually supplied tokens with automatic renewal before expiry
- **Home Assistant Discovery** - Zero-configuration entity creation

> **⚠️ DISCLAIMER:** This is an unofficial, community-developed integration. It is **NOT affiliated with, endorsed by, or supported by REHAU AG or REHAU Industries SE & Co. KG**. REHAU® and NEA SMART® are registered trademarks of REHAU. Use this software at your own risk.

---

## ✨ Features

### Core Functionality
- ✅ **Full Climate Control** - Temperature, modes, presets for all zones
- ✅ **Real-time Updates** - Instant synchronization via MQTT
- ✅ **Automatic Discovery** - Home Assistant entities created automatically
- ✅ **Token Management** - Expiry-aware renewal and durable token storage

### Web Interface
- 📱 **Progressive Web App** - Install on mobile/desktop
- 🎨 **Modern UI** - React + TypeScript with responsive design
- 🌓 **Dark Mode** - Eye-friendly interface
- 📊 **Real-time Dashboard** - System status and monitoring
- 🔐 **Secure Authentication** - JWT-based access control

### Advanced Features
- 🔄 **Staleness Detection** - Automatic data freshness monitoring
- 📈 **Resource Monitoring** - Memory and CPU usage tracking
- 📝 **Enhanced Logging** - Obfuscated, exportable logs
- 🏥 **Health Checks** - System diagnostics and monitoring

---

## 🚀 Quick Start

### Home Assistant OS (Recommended)

1. **Add Repository**
   ```
   https://github.com/manuxio/rehau-nea-smart-2-home-assistant
   ```

2. **Install Add-on**
   - Navigate to Settings → Add-ons → Add-on Store
   - Find "REHAU NEA SMART 2.0 MQTT Bridge"
   - Click Install

3. **Configure**
   - Set REHAU account email and both tokens (see [Obtain REHAU Tokens](#-obtain-rehau-tokens))
   - Set MQTT broker details

4. **Start**
   - Enable "Start on boot" and "Watchdog"
   - Click Start

### Docker

> **Note**: Docker images are automatically published to GitHub Container Registry on every release. After pushing this workflow, images will be available at `ghcr.io/manuxio/rehau-nea-smart-2-home-assistant:latest`

```bash
# Build locally (until first GHCR image is published)
cd rehau-nea-smart-mqtt-bridge
docker build -t rehau-bridge .

# Or pull from GHCR (after first publish)
docker pull ghcr.io/manuxio/rehau-nea-smart-2-home-assistant:latest

# Run
docker run -d \
  --name rehau-bridge \
  -p 3000:3000 \
  -e REHAU_EMAIL=your@email.com \
  -e REHAU_ACCESS_TOKEN=your_access_token \
  -e REHAU_REFRESH_TOKEN=your_refresh_token \
  -v rehau-data:/data \
  -e MQTT_HOST=your-mqtt-broker \
  -e API_PASSWORD=secure_password \
  rehau-bridge
  # Or: ghcr.io/manuxio/rehau-nea-smart-2-home-assistant:latest
```

### Standalone

```bash
git clone https://github.com/manuxio/rehau-nea-smart-2-home-assistant.git
cd rehau-nea-smart-2-home-assistant/rehau-nea-smart-mqtt-bridge
npm install
cp .env.example .env
# Edit .env with your credentials
npm run build
npm start
```

---

## 🔐 Obtain REHAU Tokens

The bridge requires your REHAU account email and **both** an access token and a refresh token. It never logs into REHAU with a password or reads your mailbox. The separate local API/Web UI administrator login is unchanged.

1. Open the NEA SMART web app at [http://android.neasmart.de/](http://android.neasmart.de/) in your browser (the web origin used by the existing REHAU client).
2. **Before logging in**, press **F12** to open Developer Tools → **Network**, enable **Preserve log**, and filter for **token**. If already signed in, sign out and repeat login with Network recording enabled.
3. Log in with your REHAU account. The browser redirects to `accounts.rehau.com` for authorization (`/authz-srv/authz`) and login (`/login-srv/login`). Complete email verification yourself if prompted; no mailbox credentials belong in the add-on.
4. Select the **POST** request to **https://accounts.rehau.com/token-srv/token** and open **Response**. Copy the full `access_token` and `refresh_token` from that **same response**, without JSON quotes. Do not copy an authorization code, an ID token, or a `Bearer ` prefix.
5. In Home Assistant → add-on → **Configuration**, fill `rehau_email`, `rehau_access_token`, and `rehau_refresh_token`. Both token fields are masked and mandatory. Click **Save**, then **Restart** (or **Start** for first setup).
6. The backend validates the supplied pair immediately at startup. Check the add-on log and **`sensor.rehau_token_status`** for the result. Saving alone does not restart the process or validate a token.

Renewal is scheduled **before access-token expiry**, bounded by `token_refresh_interval`. Rotated tokens are saved durably in **`/data/rehau-tokens.json`**, so unchanged configured tokens do not overwrite the latest renewed pair on restart. Mount a persistent `/data` volume in Docker; standalone deployments can set `REHAU_TOKEN_STORE_PATH` to a persistent writable path. Protect this file like a password and keep it with backups of your add-on data.

The diagnostic sensor exposes `error` (boolean) and `error_text` (sanitized explanation). If validation or renewal fails, check these attributes and your network connection. If REHAU rejects the refresh token, obtain a **new pair**, replace both fields, Save, and restart. The bridge does not fall back to password/browser login. Never share tokens, the token store, or Network/HAR exports.

---

## 📸 Screenshots

### Mobile Web UI (iPhone 14)

<div align="center">

| Dashboard | Zones | Zone Detail |
|-----------|-------|-------------|
| ![Dashboard](./rehau-nea-smart-mqtt-bridge/docs/screenshots/02-dashboard.png) | ![Zones](./rehau-nea-smart-mqtt-bridge/docs/screenshots/03-zones.png) | ![Zone Detail](./rehau-nea-smart-mqtt-bridge/docs/screenshots/04-zone-detail.png) |

| System Status | Login |
|---------------|-------|
| ![System](./rehau-nea-smart-mqtt-bridge/docs/screenshots/05-system.png) | ![Login](./rehau-nea-smart-mqtt-bridge/docs/screenshots/01-login.png) |

</div>

---

## 📚 Documentation

### Getting Started
- **[Installation Guide](./rehau-nea-smart-mqtt-bridge/README.md#installation)** - Detailed setup instructions
- **[Configuration](./rehau-nea-smart-mqtt-bridge/README.md#configuration-options)** - All available options
- **[Token Setup](./docs/configuration.md#obtaining-the-token-pair)** - Manual browser login and renewal

### Advanced
- **[REST API](http://localhost:3000/api-docs)** - Swagger documentation (when running)
- **[Docker Guide](./rehau-nea-smart-mqtt-bridge/docs/DOCKER_GUIDE.md)** - Container deployment
- **[Changelog](./rehau-nea-smart-mqtt-bridge/docs/CHANGELOG.md)** - Version history

---

## 🏠 Home Assistant Integration

### Auto-Discovered Entities

**Climate Controls** (per zone):
```yaml
climate.rehau_living_room:
  current_temperature: 21.5
  target_temperature: 22.0
  hvac_mode: heat
  preset_mode: comfort
```

**Sensors**:
- `sensor.rehau_bridge_status` - Connection status
- `sensor.rehau_auth_status` - Authentication state
- `sensor.rehau_token_status` - Token status with `error` and `error_text` attributes
- `sensor.rehau_outside_temperature` - Outdoor temperature
- `sensor.rehau_zone_*_humidity` - Zone humidity levels

**Binary Sensors**:
- `binary_sensor.rehau_zone_*_stale` - Data freshness indicators

---

## 🛠️ Troubleshooting

### Common Issues

**Authentication Fails**
```
✓ Check sensor.rehau_token_status error and error_text
✓ Verify account email and both tokens
✓ Replace rejected tokens with a new pair, Save, and restart
✓ Review logs with LOG_LEVEL=debug
```

**MQTT Connection Issues**
```
✓ Verify broker is running
✓ Check MQTT_HOST and MQTT_PORT
✓ Test with mosquitto_pub/sub
✓ Verify credentials if auth enabled
```

**Web UI Not Loading**
```
✓ Ensure API_ENABLED=true
✓ Check port 3000 is available
✓ Clear browser cache
✓ Review browser console errors
```

For detailed troubleshooting, see the [full documentation](./rehau-nea-smart-mqtt-bridge/README.md#-troubleshooting).

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## 📄 License

MIT License - See [LICENSE](./LICENSE) for details.

---

## 🙏 Acknowledgments

### Sponsors

This project is proudly sponsored by **[DomoDreams.it](https://domodreams.it)** - Your trusted partner for smart home solutions.

### Contributors

- **REHAU** for the NEA SMART 2.0 system
- **Home Assistant** community
- All contributors and users

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/manuxio/rehau-nea-smart-2-home-assistant/issues)
- **Discussions**: [GitHub Discussions](https://github.com/manuxio/rehau-nea-smart-2-home-assistant/discussions)
- **Documentation**: [Full README](./rehau-nea-smart-mqtt-bridge/README.md)

---

<div align="center">

**Made with ❤️ for the Home Assistant community**

[⬆ Back to Top](#rehau-nea-smart-20---home-assistant-integration)

</div>
