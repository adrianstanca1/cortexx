// CortexBuild Pro — Open Banking (TrueLayer) — v1.3
// Real OAuth flow. Tokens stored server-side, never exposed to the client.
// Configure via server/.env:
//   TRUELAYER_CLIENT_ID=…           (sandbox or live)
//   TRUELAYER_CLIENT_SECRET=…
//   TRUELAYER_REDIRECT_URI=https://cortexbuildpro.com/api/banking/callback
//   TRUELAYER_ENV=sandbox            (or 'live')
//
// Auto-disabled if TRUELAYER_CLIENT_ID is unset.

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const CID = process.env.TRUELAYER_CLIENT_ID || '';
const CSECRET = process.env.TRUELAYER_CLIENT_SECRET || '';
const REDIRECT = process.env.TRUELAYER_REDIRECT_URI || '';
const ENV = (process.env.TRUELAYER_ENV || 'sandbox').toLowerCase();
const AUTH_BASE = ENV === 'live' ? 'https://auth.truelayer.com' : 'https://auth.truelayer-sandbox.com';
const API_BASE  = ENV === 'live' ? 'https://api.truelayer.com'  : 'https://api.truelayer-sandbox.com';

const CONFIGURED = !!(CID && CSECRET && REDIRECT);

// Encryption for token-at-rest. Uses BANKING_ENC_KEY (32 bytes hex) or
// derives from a server secret if missing (warns).
function getEncKey() {
  const hex = process.env.BANKING_ENC_KEY;
  if (hex && hex.length === 64) return Buffer.from(hex, 'hex');
  // Derive from JWT_SECRET as a fallback so it's at least non-trivial.
  // For production: set BANKING_ENC_KEY = `openssl rand -hex 32`.
  return crypto.createHash('sha256').update(process.env.JWT_SECRET || 'cortexx-fallback').digest();
}
function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', getEncKey(), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}
function decrypt(b64) {
  const buf = Buffer.from(b64, 'base64');
  const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), ct = buf.subarray(28);
  const d = crypto.createDecipheriv('aes-256-gcm', getEncKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}

async function ensureTable(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS bank_connections (
    id           TEXT PRIMARY KEY,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id      TEXT,
    provider     TEXT,       -- truelayer provider id (e.g. ob-monzo)
    bank_name    TEXT,
    access_enc   TEXT,
    refresh_enc  TEXT,
    expires_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT now(),
    updated_at   TIMESTAMPTZ DEFAULT now()
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_bank_conn_ws ON bank_connections(workspace_id)`);
}

function abortableFetch(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 20000);
  return fetch(url, Object.assign({ signal: ctrl.signal }, opts || {})).finally(() => clearTimeout(t));
}

async function exchangeToken(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CID,
    client_secret: CSECRET,
    redirect_uri: REDIRECT,
    code,
  });
  const r = await abortableFetch(AUTH_BASE + '/connect/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) throw new Error('Token exchange: ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

async function refreshToken(refresh_token) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CID, client_secret: CSECRET,
    refresh_token,
  });
  const r = await abortableFetch(AUTH_BASE + '/connect/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) throw new Error('Refresh: ' + r.status);
  return r.json();
}

// Use a stored connection, refreshing if needed
async function withFreshToken(pool, conn) {
  const exp = conn.expires_at ? new Date(conn.expires_at).getTime() : 0;
  if (exp > Date.now() + 30000) return decrypt(conn.access_enc);
  // Refresh
  const refresh = decrypt(conn.refresh_enc);
  const tok = await refreshToken(refresh);
  await pool.query(
    `UPDATE bank_connections SET access_enc=$1, refresh_enc=$2, expires_at=$3, updated_at=now() WHERE id=$4`,
    [encrypt(tok.access_token), encrypt(tok.refresh_token || refresh), new Date(Date.now() + (tok.expires_in || 3600) * 1000), conn.id]
  );
  return tok.access_token;
}

// ── Routes ────────────────────────────────────────────────────────────
router.get('/banking/status', (_req, res) => {
  res.json({
    configured: CONFIGURED,
    env: ENV,
    redirectUri: REDIRECT || null,
    encKeySource: process.env.BANKING_ENC_KEY ? 'BANKING_ENC_KEY' : 'derived(JWT_SECRET)',
  });
});

router.get('/banking/connect', (req, res) => {
  if (!CONFIGURED) return res.status(503).json({ error: 'Open Banking not configured — set TRUELAYER_CLIENT_ID + TRUELAYER_CLIENT_SECRET + TRUELAYER_REDIRECT_URI' });
  // Build a state cookie so the callback can verify it's our request
  const nonce = crypto.randomBytes(16).toString('hex');
  res.cookie('cortexx_bank_state', nonce, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 10 * 60 * 1000 });
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CID,
    scope: 'info accounts balance cards transactions direct_debits standing_orders offline_access',
    redirect_uri: REDIRECT,
    providers: 'uk-ob-all uk-oauth-all',
    state: nonce,
  });
  res.json({ url: AUTH_BASE + '/?' + params.toString() });
});

router.get('/banking/callback', async (req, res) => {
  if (!CONFIGURED) return res.status(503).send('Open Banking not configured');
  const cookieState = req.cookies && req.cookies.cortexx_bank_state;
  const queryState = req.query.state;
  if (!cookieState || cookieState !== queryState) return res.status(400).send('State mismatch');
  res.clearCookie('cortexx_bank_state');
  const code = req.query.code;
  if (!code) return res.status(400).send('No code');
  try {
    const tok = await exchangeToken(code);
    // Fetch provider metadata
    const meta = await abortableFetch(API_BASE + '/data/v1/me', {
      headers: { authorization: 'Bearer ' + tok.access_token },
    }).then(r => r.ok ? r.json() : { results: [] });
    const me = (meta.results || [])[0] || {};
    const pool = req.app.locals.pool;
    if (!pool) return res.status(503).send('No DB pool');
    await ensureTable(pool);
    const id = crypto.randomUUID();
    // workspace_id + user_id come from the auth session — fall back to public if unknown
    const wsId = (req.user && req.user.ws) || null;
    const uid  = (req.user && req.user.id) || null;
    await pool.query(
      `INSERT INTO bank_connections (id, workspace_id, user_id, provider, bank_name, access_enc, refresh_enc, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, wsId, uid, me.provider && me.provider.provider_id, me.provider && me.provider.display_name,
       encrypt(tok.access_token), encrypt(tok.refresh_token || ''), new Date(Date.now() + (tok.expires_in || 3600) * 1000)]
    );
    // Redirect back into the app with a flag
    return res.redirect((process.env.PUBLIC_BASE_URL || '') + '/Cortexx.html?banking=connected');
  } catch (e) {
    return res.status(502).send('Token exchange failed: ' + e.message);
  }
});

router.get('/banking/connections', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    if (!pool) return res.status(503).json({ connections: [] });
    await ensureTable(pool);
    const wsId = (req.user && req.user.ws) || null;
    const r = await pool.query(
      `SELECT id, provider, bank_name, expires_at, created_at FROM bank_connections WHERE workspace_id=$1 OR workspace_id IS NULL`,
      [wsId]
    );
    res.json({ connections: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/banking/disconnect', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    if (!pool) return res.status(503).json({ error: 'no pool' });
    const wsId = (req.user && req.user.ws) || null;
    await pool.query('DELETE FROM bank_connections WHERE id=$1 AND (workspace_id=$2 OR workspace_id IS NULL)', [req.body.connectionId, wsId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/banking/transactions', async (req, res) => {
  try {
    if (!CONFIGURED) return res.status(503).json({ error: 'Open Banking not configured' });
    const pool = req.app.locals.pool;
    if (!pool) return res.status(503).json({ error: 'no pool' });
    await ensureTable(pool);
    const wsId = (req.user && req.user.ws) || null;
    const filterById = req.query.connection;
    const sql = filterById
      ? `SELECT * FROM bank_connections WHERE id=$1 AND (workspace_id=$2 OR workspace_id IS NULL)`
      : `SELECT * FROM bank_connections WHERE workspace_id=$1 OR workspace_id IS NULL`;
    const args = filterById ? [filterById, wsId] : [wsId];
    const r = await pool.query(sql, args);
    if (!r.rows.length) return res.json({ transactions: [], connections: 0 });
    const from = req.query.from || new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const to = req.query.to || new Date().toISOString().slice(0, 10);
    const all = [];
    for (const conn of r.rows) {
      try {
        const tok = await withFreshToken(pool, conn);
        // list accounts
        const acc = await abortableFetch(API_BASE + '/data/v1/accounts', { headers: { authorization: 'Bearer ' + tok } }).then(r => r.json());
        for (const a of (acc.results || [])) {
          const tx = await abortableFetch(
            `${API_BASE}/data/v1/accounts/${a.account_id}/transactions?from=${from}&to=${to}`,
            { headers: { authorization: 'Bearer ' + tok } }
          ).then(r => r.json());
          for (const t of (tx.results || [])) {
            all.push({
              date: (t.timestamp || '').slice(0, 10),
              desc: t.description || t.merchant_name || t.transaction_type || '',
              amount: Math.abs(+t.amount || 0),
              kind: t.transaction_type === 'CREDIT' || (+t.amount > 0) ? 'credit' : 'debit',
              connectionId: conn.id, accountId: a.account_id,
              raw: t.description || '',
            });
          }
        }
      } catch (e) { /* skip this connection on failure */ }
    }
    res.json({ transactions: all, connections: r.rows.length, from, to });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
