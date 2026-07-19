// CortexBuild Pro — Push notifications (v1.3)
// Web Push (VAPID) + Capacitor native passthrough.
//
// Endpoints:
//   GET  /api/push/vapid       → public key
//   POST /api/push/subscribe   → store subscription
//   POST /api/push/unsubscribe → drop subscription
//   POST /api/push/send        → send a notification (admin)
//
// Uses the `web-push` npm package for Web Push, and a plain POST to FCM/APNs
// when handed a native token. Auto-disabled if VAPID_* env vars unset.

const express = require('express');
const router = express.Router();

let webpush = null;
try { webpush = require('web-push'); } catch (e) { /* optional dep */ }

const VAPID_PUB = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIV = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:sales@cortexbuildpro.com';

if (webpush && VAPID_PUB && VAPID_PRIV) {
  try { webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUB, VAPID_PRIV); }
  catch (e) { console.error('[push] VAPID setup failed:', e.message); }
}

async function ensurePushTable(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY, endpoint TEXT UNIQUE NOT NULL, platform TEXT, sub JSONB NOT NULL,
    user_id TEXT, workspace_id UUID, created_at TIMESTAMPTZ DEFAULT now()
  )`);
  // Backfill the column on deployments that created the table before tenant scoping.
  await pool.query(`ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS workspace_id UUID`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_push_ws ON push_subscriptions(workspace_id)`);
}

// Is the caller an admin/director in their workspace? Sending broadcasts is an
// elevated action, so gate it beyond merely being authenticated.
async function isAdmin(pool, uid) {
  if (!pool || !uid) return false;
  try {
    const r = await pool.query('SELECT role FROM users WHERE id=$1', [uid]);
    const role = (r.rows[0] && r.rows[0].role || '').toLowerCase();
    return role === 'director' || role === 'admin' || role === 'owner';
  } catch { return false; }
}

router.get('/push/vapid', (_req, res) => {
  if (!VAPID_PUB) return res.status(503).json({ error: 'VAPID_PUBLIC_KEY not configured on server' });
  res.json({ publicKey: VAPID_PUB });
});

router.post('/push/subscribe', async (req, res) => {
  try {
    const sub = req.body && req.body.subscription;
    const platform = (req.body && req.body.platform) || 'web';
    if (!sub) return res.status(400).json({ error: 'subscription required' });
    // Persist via the generic invoices/projects DB pool the server uses
    // (cheap impl: use the `push_subscriptions` collection through req.app.locals.pool if available)
    const pool = req.app.locals.pool;
    if (pool) {
      try {
        await ensurePushTable(pool);
        await pool.query(
          'INSERT INTO push_subscriptions (endpoint, platform, sub, user_id, workspace_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (endpoint) DO UPDATE SET sub=$3, platform=$2, user_id=$4, workspace_id=$5',
          [sub.endpoint || ('native:' + (sub.token || '')), platform, sub, req.user.uid || null, req.user.ws]
        );
      } catch (e) { console.error('[push/subscribe] DB:', e.message); }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/push/unsubscribe', async (req, res) => {
  try {
    const endpoint = req.body && req.body.endpoint;
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
    const pool = req.app.locals.pool;
    // Only remove a subscription belonging to the caller's workspace.
    if (pool) { try { await pool.query('DELETE FROM push_subscriptions WHERE endpoint=$1 AND workspace_id=$2', [endpoint, req.user.ws]); } catch (e) {} }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const https = require('https');

// Deliver a notification to a native (Expo) token. The subscription was stored
// with endpoint = 'native:' + expoToken and sub.token = the Expo push token.
// Expo tokens look like "ExponentPushToken[xxxx]". We POST to Expo's push
// service (no extra SDK needed — just an HTTPS request).
function sendExpo(token, payload) {
  const body = JSON.stringify({
    to: token,
    title: payload.title,
    body: payload.body,
    data: { url: payload.url, at: payload.at },
    sound: 'default',
  });
  const data = Buffer.from(body);
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: 'exp.host', path: '/--/api/v2/push/send', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          try { const j = JSON.parse(buf); resolve(j); }
          catch (e) { reject(e); }
        });
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

router.post('/push/send', async (req, res) => {
  const title = String((req.body && req.body.title) || 'CortexBuild Pro');
  const body  = String((req.body && req.body.body)  || '');
  const url   = String((req.body && req.body.url)   || '/');
  const audience = (req.body && req.body.audience) || 'all';
  const pool = req.app.locals.pool;
  if (!pool) return res.status(503).json({ error: 'DB pool not available' });
  // Broadcasting is admin-only, and only ever reaches the caller's own workspace.
  if (!(await isAdmin(pool, req.user.uid))) return res.status(403).json({ error: 'forbidden' });
  try {
    await ensurePushTable(pool);
    let rows = [];
    try { const r = await pool.query('SELECT endpoint, sub FROM push_subscriptions WHERE workspace_id=$1', [req.user.ws]); rows = r.rows || []; }
    catch (e) { return res.status(503).json({ error: 'push_subscriptions table not initialised' }); }
    let sent = 0, failed = 0, webSkipped = 0;
    const payload = JSON.stringify({ title, body, url, at: Date.now() });
    for (const row of rows) {
      const endpoint = row.endpoint || '';
      const sub = row.sub || {};
      const nativeToken = (typeof sub.token === 'string' && sub.token) ? sub.token : (endpoint.startsWith('native:') ? endpoint.slice(7) : '');
      // Native (Expo) path: deliver via Expo's push service. Works WITHOUT VAPID.
      if (nativeToken && /ExponentPushToken\[/.test(nativeToken)) {
        try { await sendExpo(nativeToken, JSON.parse(payload)); sent++; }
        catch (e) { failed++; if (e.statusCode === 410) { try { await pool.query('DELETE FROM push_subscriptions WHERE endpoint=$1 AND workspace_id=$2', [row.endpoint, req.user.ws]); } catch (_) {} } }
        continue;
      }
      // Web Push path (VAPID) — only if web-push + VAPID are configured.
      if (!webpush || !VAPID_PUB) { webSkipped++; continue; }
      try { await webpush.sendNotification(row.sub, payload); sent++; }
      catch (e) { failed++; if (e.statusCode === 410 || e.statusCode === 404) { try { await pool.query('DELETE FROM push_subscriptions WHERE endpoint=$1 AND workspace_id=$2', [row.endpoint, req.user.ws]); } catch (_) {} } }
    }
    res.json({ sent, failed, webSkipped, total: rows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
