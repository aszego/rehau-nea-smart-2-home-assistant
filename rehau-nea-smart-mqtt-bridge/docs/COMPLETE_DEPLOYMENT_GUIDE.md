# Complete Deployment Guide

## 🚀 All Features Implemented and Ready!

All requested features have been implemented. Follow these steps to deploy:

---

## Step 1: Stop Running Servers

**IMPORTANT**: Stop any running instances of the bridge before building.

Find and stop Node.js processes:
```powershell
# Windows PowerShell
Get-Process node | Stop-Process -Force

# Or use Task Manager:
# 1. Open Task Manager (Ctrl+Shift+Esc)
# 2. Find "Node.js" processes
# 3. End all Node.js tasks
```

---

## Step 2: Build Backend

```powershell
npm run build
```

Expected output:
```
> rehau-nea-smart-mqtt-bridge-typescript@4.0.39 build
> tsc

✓ Backend compiled successfully
```

---

## Step 3: Build Web UI

```powershell
cd web-ui
npm run build
cd ..
```

Expected output:
```
vite v7.3.1 building for production...
✓ built in 3.45s
✓ Web UI built successfully
```

---

## Step 4: Copy PWA Files

```powershell
# Copy service worker
Copy-Item "web-ui\public\sw.js" "web-ui\dist\sw.js" -Force

# Copy manifest
Copy-Item "web-ui\public\manifest.json" "web-ui\dist\manifest.json" -Force

# Copy icons (if available)
if (Test-Path "icon.png") {
  Copy-Item "icon.png" "web-ui\dist\icon-192.png" -Force
  Copy-Item "icon.png" "web-ui\dist\icon-512.png" -Force
}
```

---

## Step 5: Start the Server

```powershell
npm start
```

The server will start with all new features enabled!

---

## ✅ What's New

### 1. Renewable REHAU Tokens

[Obtain the access/refresh pair manually](../../docs/configuration.md#obtaining-the-token-pair). Configure both tokens and your REHAU email, then restart for immediate validation. Renewal is scheduled before expiry and saved in `/data/rehau-tokens.json`. Persist `/data` in Docker. API/Web UI admin login remains separate.

### 2. PWA Support
- Installable as standalone app
- Offline support
- Service worker caching
- App manifest

### 3. Pull-to-Refresh
- Native mobile gesture
- Visual feedback
- Smooth animations

### 4. Haptic Feedback
- Button press vibrations
- Multiple feedback styles
- Cross-platform support

### 5. Offline Indicator
- Shows connection status
- Automatic detection
- Non-intrusive banner

### 6. Directional Indicators (Ready)
- ⬆️ Outgoing data
- ⬇️ Incoming data
- 🔄 Internal processing
- 🔌 Bidirectional/Status

---

## 🧪 Testing

### Test PWA Features

1. Open browser to `http://localhost:3000`
2. Look for "Install" prompt at bottom
3. Click "Install" to add to home screen
4. Open installed app (standalone mode)
5. Turn off WiFi to test offline indicator
6. Pull down from top to test pull-to-refresh

### Test Token Validation

Restart after saving the token pair and check `sensor.rehau_token_status` `error` and `error_text`. Use a persistent token store and verify renewal survives restarts.

## 📝 Configuration

Use [.env.example](../.env.example) and the [current configuration guide](../../docs/configuration.md). Only REHAU email and access/refresh tokens are accepted for cloud authentication.

## 🎯 Verification Checklist

After deployment, verify:

- [ ] Server starts without errors
- [ ] Web UI loads at http://localhost:3000
- [ ] Login works
- [ ] Dashboard shows zones
- [ ] Install prompt appears (PWA)
- [ ] Offline indicator works (turn off WiFi)
- [ ] Pull-to-refresh works (pull down from top)
- [ ] Buttons vibrate on mobile (haptic feedback)

---

## 🐛 Troubleshooting

### Build Errors

If you see TypeScript errors:
```powershell
# Clean and rebuild
Remove-Item -Recurse -Force dist
npm run build
```

### Web UI Not Loading

```powershell
# Rebuild web UI
cd web-ui
Remove-Item -Recurse -Force dist
npm run build
cd ..
```

### Service Worker Not Registering

1. Check browser console for errors
2. Verify `sw.js` exists in `web-ui/dist/`
3. Clear browser cache (Ctrl+Shift+Delete)
4. Hard reload (Ctrl+F5)

### Token Renewal Fails

Check the token status sensor error attributes and network access. If REHAU rejects refresh, obtain a new pair, replace both fields, Save, and restart. Never share tokens or the token store.

## 📚 Documentation

- `FEATURE_IMPLEMENTATION_SUMMARY.md` - Complete feature list
- `.env.example` - Configuration template

---

## 🎉 Success!

All features are implemented and ready to use. The bridge is now a modern, full-featured web application with:

✅ PWA support (installable app)
✅ Pull-to-refresh gesture
✅ Haptic feedback
✅ Offline indicator
✅ Directional logging (ready to integrate)

Enjoy your enhanced REHAU control system!
