# Quick Start Guide - v5.0.0

## 🚀 Fastest Way to Get Started

### Docker (Recommended)

```bash
# 1. Navigate to directory
cd rehau-nea-smart-mqtt-bridge

# 2. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 3. Build and run
docker build -t rehau-bridge:v5.0.0 .
docker run -d --name rehau-bridge -p 3000:3000 -v rehau-data:/data --env-file .env rehau-bridge:v5.0.0

# 4. Check logs
docker logs rehau-bridge -f

# 5. Access Web UI
# Open: http://localhost:3000
```

## 📋 Minimum Required Configuration

[Obtain both tokens by manual browser login](../../docs/configuration.md#obtaining-the-token-pair). Save and restart validates them immediately; renewal runs before expiry and persists rotated tokens in `/data`. API/Web UI admin credentials remain separate.

Edit `.env` with these essential settings:

```env
# REHAU Account
REHAU_EMAIL=your.email@example.com
REHAU_ACCESS_TOKEN=your_access_token
REHAU_REFRESH_TOKEN=your_refresh_token
REHAU_TOKEN_STORE_PATH=/data/rehau-tokens.json

# MQTT Broker
MQTT_HOST=localhost
MQTT_PORT=1883

# API Access
API_PASSWORD=your_secure_password
```

## 🔗 Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| Web UI | http://localhost:3000 | API_USERNAME / API_PASSWORD |
| API Docs | http://localhost:3000/api-docs | Same as above |
| Health Check | http://localhost:3000/health | No auth required |

## ✅ Verify Installation

```bash
# Check health
curl http://localhost:3000/health

# Expected: {"status":"healthy",...}

# Check logs for success messages
docker logs rehau-bridge | grep "🚀\|✅\|🔐"
```

## 🏠 Home Assistant Setup

1. Ensure MQTT broker is running
2. Start the bridge
3. Check Home Assistant → Settings → Devices & Services → MQTT
4. Climate entities should auto-appear as `climate.rehau_*`

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 3000 in use | Use `-p 3001:3000` instead |
| Token validation/renewal fails | Check `sensor.rehau_token_status` error/error_text; replace both rejected tokens and restart |
| MQTT not connecting | Check MQTT_HOST and port |

## 📚 Full Documentation

- [README.md](README.md) - Complete documentation
- [CHANGELOG.md](CHANGELOG.md) - Version history
- [DOCKER_GUIDE.md](DOCKER_GUIDE.md) - Docker details
- [BUILD_AND_TEST.md](../BUILD_AND_TEST.md) - Testing guide

## 🆘 Need Help?

1. Check logs: `docker logs rehau-bridge -f`
2. Review [Troubleshooting](README.md#-troubleshooting)
3. Open issue on GitHub

---

**Version**: 5.0.0
**Status**: Production Ready
**Support**: Node.js 20+, Docker 24+
