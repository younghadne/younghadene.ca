#!/usr/bin/env node
/**
 * Young Hadene — Admin API Server
 * Provides settings management and scheduled blog generation.
 *
 * Usage:
 *   node server.js
 *
 * The admin panel at admin.html communicates with this server
 * to configure daily scheduled blog post generation.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 3456;
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const LOG_DIR = path.join(__dirname, 'logs');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const DEFAULTS = {
  enabled: false,
  time: '09:00',
  quantity: 1,
  lastRun: null,
  lastRunPosts: 0,
  lastRunStatus: null,
  nextRun: null,
  totalGenerated: 0,
};

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) };
  } catch { return { ...DEFAULTS }; }
}

function save(s) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2));
}

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  fs.appendFileSync(path.join(LOG_DIR, 'server.log'), line + '\n');
}

function generatePosts(quantity) {
  const results = [];
  let success = 0;
  let fail = 0;

  return (async function run() {
    for (let i = 0; i < quantity; i++) {
      try {
        const out = await new Promise((resolve, reject) => {
          const child = spawn('node', ['scripts/generate-post.js'], {
            cwd: __dirname,
            env: { ...process.env },
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          let stdout = '', stderr = '';
          child.stdout.on('data', d => stdout += d);
          child.stderr.on('data', d => stderr += d);
          child.on('close', code => {
            if (code === 0) resolve(stdout);
            else reject(new Error(stderr || stdout));
          });
        });
        results.push({ ok: true, output: out.split('\n').filter(Boolean).pop() });
        success++;
      } catch (e) {
        results.push({ ok: false, error: e.message });
        fail++;
      }
    }
    return { results, success, fail };
  })();
}

// ── Scheduler ──
let schedulerTimer = null;

function parseTime(str) {
  const [h, m] = str.split(':').map(Number);
  return { h, m };
}

function calcNextRun(settings) {
  if (!settings.enabled) return null;
  const { h, m } = parseTime(settings.time);
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.toISOString();
}

function tick() {
  const settings = load();
  if (!settings.enabled) return;

  const now = new Date();
  const { h, m } = parseTime(settings.time);

  if (now.getHours() === h && now.getMinutes() === m && settings.nextRun) {
    const nextTime = new Date(settings.nextRun).getTime();
    // Only run within a 60-second window of the scheduled time
    if (Math.abs(now.getTime() - nextTime) < 120000) {
      log(`⏰ Scheduled run triggered (${settings.quantity} post(s))`);
      generatePosts(settings.quantity).then(result => {
        const updated = load();
        updated.lastRun = now.toISOString();
        updated.lastRunPosts = result.success;
        updated.lastRunStatus = result.fail === 0 ? 'success' : result.fail > 0 && result.success > 0 ? 'partial' : 'failed';
        updated.totalGenerated = (updated.totalGenerated || 0) + result.success;
        updated.nextRun = calcNextRun(updated);
        save(updated);
        log(`✅ Scheduled run complete: ${result.success} ok, ${result.fail} failed`);
      }).catch(e => {
        log(`❌ Scheduled run error: ${e.message}`);
      });
    }
  }
}

function startScheduler() {
  if (schedulerTimer) clearInterval(schedulerTimer);
  schedulerTimer = setInterval(tick, 30000); // check every 30s
  log('⏰ Scheduler started (checking every 30s)');
}

// ── HTTP Server ──
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  const json = (data, code = 200) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  // GET /api/settings
  if (url.pathname === '/api/settings' && req.method === 'GET') {
    const s = load();
    s.nextRun = calcNextRun(s);
    return json(s);
  }

  // POST /api/settings
  if (url.pathname === '/api/settings' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const current = load();
        const updated = { ...current, ...data };
        updated.nextRun = calcNextRun(updated);
        save(updated);
        log(`⚙️ Settings updated: enabled=${updated.enabled} time=${updated.time} quantity=${updated.quantity}`);
        startScheduler();
        return json(updated);
      } catch (e) { return json({ error: e.message }, 400); }
    });
    return;
  }

  // POST /api/generate
  if (url.pathname === '/api/generate' && req.method === 'POST') {
    const q = Math.min(Math.max(parseInt(url.searchParams.get('q') || '1', 10) || 1, 1), 20);
    log(`🚀 Manual generate triggered: ${q} post(s)`);
    generatePosts(q).then(result => {
      const updated = load();
      updated.lastRun = new Date().toISOString();
      updated.lastRunPosts = result.success;
      updated.lastRunStatus = result.fail === 0 ? 'success' : 'partial';
      updated.totalGenerated = (updated.totalGenerated || 0) + result.success;
      updated.nextRun = calcNextRun(updated);
      save(updated);
      return json({ success: true, count: result.success, fails: result.fail, results: result.results });
    }).catch(e => {
      log(`❌ Generate error: ${e.message}`);
      return json({ error: e.message }, 500);
    });
    return;
  }

  // GET /api/status
  if (url.pathname === '/api/status' && req.method === 'GET') {
    return json({ ok: true, uptime: process.uptime(), pid: process.pid });
  }

  // ── Static file server (fallback) ──
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  filePath = path.join(__dirname, filePath);

  const ext = path.extname(filePath);
  const mime = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.webp': 'image/webp', '.xml': 'application/xml',
    '.txt': 'text/plain', '.woff2': 'font/woff2',
  };

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }

  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  log(`🎤 Admin API running on http://localhost:${PORT}`);
  log(`📁 Settings: ${SETTINGS_FILE}`);
  const s = load();
  if (s.enabled) {
    const next = calcNextRun(s);
    log(`⏰ Next scheduled run: ${next}`);
  } else {
    log('⏸️  Scheduled generation is disabled');
  }
  startScheduler();
});
