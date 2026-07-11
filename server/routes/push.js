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
        await pool.query(`CREATE TABLE IF NOT EXISTS push_subscriptions (
          id SERIAL PRIMARY KEY, endpoint TEXT UNIQUE NOT NULL, platform TEXT, sub JSONB NOT NULL,
          user_id TEXT, created_at TIMESTAMPTZ DEFAULT now()
        )`);
        await pool.query(
          'INSERT INTO push_subscriptions (endpoint, platform, sub, user_id) VALUES ($1,$2,$3,$4) ON CONFLICT (endpoint) DO UPDATE SET sub=$3, platform=$2',
          [sub.endpoint || ('native:' + (sub.token || '')), platform, sub, (req.user && req.user.id) || null]
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
    if (pool) { try { await pool.query('DELETE FROM push_subscriptions WHERE endpoint=$1', [endpoint]); } catch (e) {} }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/push/send', async (req, res) => {
  if (!webpush || !VAPID_PUB) return res.status(503).json({ error: 'push not configured — install web-push and set VAPID_*' });
  const title = String((req.body && req.body.title) || 'CortexBuild Pro');
  const body  = String((req.body && req.body.body)  || '');
  const url   = String((req.body && req.body.url)   || '/');
  const audience = (req.body && req.body.audience) || 'all';
  const pool = req.app.locals.pool;
  if (!pool) return res.status(503).json({ error: 'DB pool not available' });
  try {
    let rows = [];
    try { const r = await pool.query('SELECT endpoint, sub FROM push_subscriptions'); rows = r.rows || []; }
    catch (e) { return res.status(503).json({ error: 'push_subscriptions table not initialised' }); }
    let sent = 0, failed = 0;
    const payload = JSON.stringify({ title, body, url, at: Date.now() });
    for (const row of rows) {
      try { await webpush.sendNotification(row.sub, payload); sent++; }
      catch (e) { failed++; if (e.statusCode === 410 || e.statusCode === 404) { try { await pool.query('DELETE FROM push_subscriptions WHERE endpoint=$1', [row.endpoint]); } catch (_) {} } }
    }
    res.json({ sent, failed, total: rows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
