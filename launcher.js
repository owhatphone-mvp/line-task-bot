/**
 * LINE Task Bot Launcher
 * - เปิด Node.js server อัตโนมัติ
 * - เปิด Cloudflare Tunnel อัตโนมัติ
 * - ดึง URL tunnel แล้วอัพเดต LINE Webhook อัตโนมัติ
 * - ถ้า tunnel หลุด จะ restart และอัพเดต webhook ใหม่อัตโนมัติ
 */

require('dotenv').config();
const { spawn } = require('child_process');
const https = require('https');
const http = require('http');

const CLOUDFLARED_PATH = 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe';
const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const SERVER_PORT = process.env.PORT || 3000;

let serverProcess = null;
let tunnelProcess = null;
let currentTunnelUrl = null;
let restartCount = 0;
const MAX_RESTARTS = 100;

function log(msg) {
  const time = new Date().toLocaleTimeString('th-TH');
  console.log(`[${time}] ${msg}`);
}

// --- 1. เปิด Node.js Server ---
function startServer() {
  return new Promise((resolve) => {
    log('Starting Node.js server...');
    serverProcess = spawn('node', ['server.js'], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    serverProcess.stdout.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) log(`[SERVER] ${msg}`);
      if (msg.includes('Server running')) {
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      log(`[SERVER ERR] ${data.toString().trim()}`);
    });

    serverProcess.on('close', (code) => {
      log(`[SERVER] Process exited with code ${code}`);
      // restart server if it crashes
      setTimeout(() => {
        log('Restarting server...');
        startServer();
      }, 3000);
    });

    // resolve after 5 seconds if server doesn't log "running"
    setTimeout(resolve, 5000);
  });
}

// --- 2. เปิด Cloudflare Tunnel ---
function startTunnel() {
  return new Promise((resolve) => {
    log('Starting Cloudflare Tunnel...');
    restartCount++;

    if (restartCount > MAX_RESTARTS) {
      log('Max restart count reached. Exiting.');
      process.exit(1);
    }

    tunnelProcess = spawn(CLOUDFLARED_PATH, [
      'tunnel', '--url', `http://localhost:${SERVER_PORT}`,
      '--no-autoupdate'
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let urlFound = false;

    const handleOutput = (data) => {
      const text = data.toString();
      // ค้นหา URL ของ tunnel
      const urlMatch = text.match(/https:\/\/[a-zA-Z0-9\-]+\.trycloudflare\.com/);
      if (urlMatch && !urlFound) {
        urlFound = true;
        currentTunnelUrl = urlMatch[0];
        log(`Tunnel URL: ${currentTunnelUrl}`);
        resolve(currentTunnelUrl);
      }
    };

    tunnelProcess.stdout.on('data', handleOutput);
    tunnelProcess.stderr.on('data', handleOutput);

    tunnelProcess.on('close', (code) => {
      log(`[TUNNEL] Process exited with code ${code}. Restarting in 5 seconds...`);
      setTimeout(async () => {
        try {
          const url = await startTunnel();
          await updateWebhook(url);
        } catch (err) {
          log(`Restart error: ${err.message}`);
        }
      }, 5000);
    });

    // timeout - tunnel URL not found in 30 sec
    setTimeout(() => {
      if (!urlFound) {
        log('Tunnel URL not found within 30 seconds, retrying...');
        if (tunnelProcess) tunnelProcess.kill();
      }
    }, 30000);
  });
}

// --- 2.5 รอ tunnel พร้อมใช้งานจริง ---
function waitForTunnel(tunnelUrl, maxRetries = 10) {
  return new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      log(`Checking tunnel is reachable (attempt ${attempts})...`);
      const url = new URL(tunnelUrl);
      const req = https.get({
        hostname: url.hostname,
        path: '/',
        timeout: 5000
      }, (res) => {
        log(`Tunnel reachable! Status: ${res.statusCode}`);
        res.resume();
        resolve(true);
      });
      req.on('error', () => {
        if (attempts < maxRetries) {
          log('Tunnel not ready yet, retrying in 3s...');
          setTimeout(check, 3000);
        } else {
          log('Tunnel check timed out, proceeding anyway...');
          resolve(false);
        }
      });
      req.on('timeout', () => {
        req.destroy();
        if (attempts < maxRetries) {
          log('Tunnel not ready yet, retrying in 3s...');
          setTimeout(check, 3000);
        } else {
          resolve(false);
        }
      });
    };
    check();
  });
}

// --- 3. อัพเดต LINE Webhook URL (with retry) ---
async function updateWebhook(tunnelUrl, retries = 5) {
  const webhookUrl = `${tunnelUrl}/webhook`;
  
  for (let i = 0; i < retries; i++) {
    try {
      await doUpdateWebhook(webhookUrl);
      return;
    } catch (err) {
      log(`Webhook update attempt ${i + 1} failed: ${err.message}`);
      if (i < retries - 1) {
        log(`Retrying in 5 seconds...`);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }
  log('WARNING: Could not update webhook after all retries. Bot may not receive messages.');
}

function doUpdateWebhook(webhookUrl) {
  return new Promise((resolve, reject) => {
    log(`Updating LINE Webhook to: ${webhookUrl}`);

    const body = JSON.stringify({ endpoint: webhookUrl });

    const req = https.request({
      hostname: 'api.line.me',
      path: '/v2/bot/channel/webhook/endpoint',
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          log('LINE Webhook updated successfully!');
          resolve();
        } else {
          log(`Webhook update failed (${res.statusCode}): ${data}`);
          reject(new Error(`Status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      log(`Webhook update error: ${err.message}`);
      reject(err);
    });

    req.write(body);
    req.end();
  });
}

// --- 4. ทดสอบ Webhook ---
function testWebhook(tunnelUrl) {
  return new Promise((resolve) => {
    const webhookUrl = `${tunnelUrl}/webhook`;
    log(`Testing webhook endpoint...`);

    const body = JSON.stringify({ endpoint: webhookUrl });

    const req = https.request({
      hostname: 'api.line.me',
      path: '/v2/bot/channel/webhook/endpoint/test',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.success) {
            log('Webhook test PASSED!');
          } else {
            log(`Webhook test result: ${data}`);
          }
        } catch {
          log(`Webhook test response: ${data}`);
        }
        resolve();
      });
    });

    req.on('error', (err) => {
      log(`Webhook test error: ${err.message}`);
      resolve();
    });

    req.write(body);
    req.end();
  });
}

// --- Main ---
async function main() {
  console.log('='.repeat(50));
  log('LINE Task Bot Launcher');
  console.log('='.repeat(50));

  if (!LINE_ACCESS_TOKEN) {
    log('ERROR: LINE_CHANNEL_ACCESS_TOKEN not found in .env');
    process.exit(1);
  }

  // Step 1: Start server
  await startServer();
  log('Server is ready');

  // Step 2: Start tunnel
  const tunnelUrl = await startTunnel();

  // Step 3: Wait for tunnel to be reachable
  await waitForTunnel(tunnelUrl);

  // Step 4: Update webhook (with retries)
  await updateWebhook(tunnelUrl);

  // Step 5: Test webhook
  await new Promise(r => setTimeout(r, 3000));
  await testWebhook(tunnelUrl);

  console.log('='.repeat(50));
  log('Bot is running! Press Ctrl+C to stop.');
  log(`Tunnel URL: ${currentTunnelUrl}`);
  log(`Webhook: ${currentTunnelUrl}/webhook`);
  console.log('='.repeat(50));
}

// Graceful shutdown
process.on('SIGINT', () => {
  log('Shutting down...');
  if (serverProcess) serverProcess.kill();
  if (tunnelProcess) tunnelProcess.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Shutting down...');
  if (serverProcess) serverProcess.kill();
  if (tunnelProcess) tunnelProcess.kill();
  process.exit(0);
});

main().catch((err) => {
  log(`Error: ${err.message}. Retrying in 10 seconds...`);
  setTimeout(() => main(), 10000);
});
