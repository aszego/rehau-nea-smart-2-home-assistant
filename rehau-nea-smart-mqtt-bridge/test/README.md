# Test Suite

This folder contains tests for the REHAU NEA SMART 2.0 MQTT Bridge project.

## Available Tests

### Token Authentication and Configuration Tests

**File**: `../tests/token-auth.test.ts`

**Run** from the add-on directory:
```bash
npm test -- --runInBand token-auth
```

Covers required email/access/refresh tokens, immediate server validation, installation loading, renewal before expiry, concurrent renewal, rotated-token persistence, failure reporting and recovery, and timer cleanup. HTTP requests are mocked; no credentials are required.

The separate Web UI admin login regression tests can be included with:
```bash
npm test -- --runInBand token-auth auth.test
```

### Memory Leaks and Cleanup Tests

**File**: Documentation and manual tests

**Run manual tests**:

1. **Monitor memory usage during prolonged execution**:
   ```bash
   # Start the application
   npm start

   # In another terminal, monitor memory usage every 10 seconds
   watch -n 10 'ps aux | grep node | grep -v grep | awk "{print \$6/1024 \" MB\"}"'
   ```

2. **Verify cleanup on shutdown**:
   ```bash
   # Start the application
   npm start

   # Wait for complete initialization
   # Send SIGTERM or SIGINT (Ctrl+C)
   # Verify in logs that all cleanup operations were executed
   ```

3. **Verify cleanup on critical errors**:
   ```bash
   # Start the application
   npm start

   # Simulate critical error (e.g. kill -9)
   # Verify that cleanup is called even for unhandled errors
   ```

**What to verify**:
- ✅ Memory usage does not constantly increase during prolonged execution
- ✅ All timers are properly cleaned up on shutdown
- ✅ All subscriptions are removed on shutdown
- ✅ All MQTT connections are properly closed
- ✅ Cleanup is called even on critical errors (uncaughtException, unhandledRejection)
- ✅ Cleanup is idempotent (multiple calls are safe)
- ✅ No memory leaks after multiple shutdowns and restarts

**Example script for memory monitoring**:
```javascript
// monitor-memory.js
const { spawn } = require('child_process');

const app = spawn('npm', ['start'], { stdio: 'inherit' });

setInterval(() => {
  const memUsage = process.memoryUsage();
  console.log(`Memory: RSS=${(memUsage.rss/1024/1024).toFixed(2)}MB, Heap=${(memUsage.heapUsed/1024/1024).toFixed(2)}MB`);
}, 10000);

app.on('exit', () => {
  console.log('Application exited');
  process.exit(0);
});
```

## Notes

Automated tests use Jest with `ts-jest`. Token tests use fake timers and temporary files that are removed after each test.
