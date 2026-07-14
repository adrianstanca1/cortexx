// CortexBuild Pro — In-app subscriptions (v1.3)
// Routes:
//   POST /api/iap/verify        — verify Apple receipt, mint server-side entitlement
//   POST /api/iap/checkout      — create Stripe subscription Checkout session
//   POST /api/iap/portal        — create Stripe billing-portal session
//   GET  /api/iap/entitlement   — return current entitlement for the workspace
//   POST /api/iap/webhook       — Stripe webhook (subscription.updated/deleted)
//
// Auto-disabled if neither STRIPE_SECRET_KEY nor APPLE_SHARED_SECRET is set.

const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const APPLE_SHARED_SECRET = process.env.APPLE_SHARED_SECRET || '';
const APP_URL = process.env.PUBLIC_BASE_URL || 'https://cortexbuildpro.com';

// Verify a Stripe webhook signature against the RAW request body.
// Header format: "t=<unix>,v1=<hex hmac>[,v1=...]". We HMAC-SHA256 `${t}.${raw}`
// with the endpoint secret and constant-time compare against any provided v1.
function verifyStripeSignature(rawBuf, sigHeader, secret, toleranceSec = 300) {
  if (!secret || !sigHeader || !rawBuf) return false;
  const parts = Object.create(null);
  for (const kv of String(sigHeader).split(',')) {
    const i = kv.indexOf('=');
    if (i === -1) continue;
    const k = kv.slice(0, i).trim();
    const v = kv.slice(i + 1).trim();
    if (k === 'v1') (parts.v1 || (parts.v1 = [])).push(v);
    else parts[k] = v;
  }
  if (!parts.t || !parts.v1 || !parts.v1.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > toleranceSec) return false;
  const expected = crypto.createHmac('sha256', secret).update(parts.t + '.' + rawBuf.toString('utf8')).digest('hex');
  const expBuf = Buffer.from(expected, 'hex');
  return parts.v1.some(sig => {
    let sb; try { sb = Buffer.from(sig, 'hex'); } catch { return false; }
    return sb.length === expBuf.length && crypto.timingSafeEqual(sb, expBuf);
  });
}

function abortableFetch(url, opts, ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms || 15000);
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
}
function form(o) {
  return Object.entries(o).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
}

async function ensureTable(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS iap_entitlements (
    id            SERIAL PRIMARY KEY,
    workspace_id  UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id       TEXT,
    source        TEXT,        -- 'apple' | 'stripe'
    plan          TEXT,
    product_id    TEXT,
    external_id   TEXT,        -- Apple original_transaction_id or Stripe sub id
    status        TEXT,        -- 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired'
    expires_at    TIMESTAMPTZ,
    raw           JSONB,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_iap_ws ON iap_entitlements(workspace_id, status)`);
  // Dedup key so re-verified Apple receipts / replayed Stripe events UPDATE the
  // existing row instead of inserting duplicates. Partial (external_id NOT NULL).
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_iap_source_extid
    ON iap_entitlements(source, external_id) WHERE external_id IS NOT NULL`);
}

async function upsertEntitlement(pool, row) {
  if (row.external_id) {
    await pool.query(
      `INSERT INTO iap_entitlements (workspace_id, user_id, source, plan, product_id, external_id, status, expires_at, raw, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
       ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL
       DO UPDATE SET status=EXCLUDED.status, expires_at=EXCLUDED.expires_at, raw=EXCLUDED.raw,
                     plan=EXCLUDED.plan, product_id=EXCLUDED.product_id, updated_at=now()`,
      [row.workspace_id, row.user_id, row.source, row.plan, row.product_id, row.external_id, row.status, row.expires_at, row.raw]
    );
  } else {
    await pool.query(
      `INSERT INTO iap_entitlements (workspace_id, user_id, source, plan, product_id, external_id, status, expires_at, raw, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())`,
      [row.workspace_id, row.user_id, row.source, row.plan, row.product_id, row.external_id, row.status, row.expires_at, row.raw]
    );
  }
}

// ── Apple receipt verification ────────────────────────────────────────
async function verifyAppleReceipt(receiptBase64) {
  if (!APPLE_SHARED_SECRET) throw new Error('APPLE_SHARED_SECRET not configured');
  const body = JSON.stringify({
    'receipt-data': receiptBase64,
    'password': APPLE_SHARED_SECRET,
    'exclude-old-transactions': true,
  });
  // Always try production first, fall back to sandbox on 21007
  let r = await abortableFetch('https://buy.itunes.apple.com/verifyReceipt', { method: 'POST', body, headers: { 'content-type': 'application/json' } });
  let j = await r.json();
  if (j.status === 21007) {
    r = await abortableFetch('https://sandbox.itunes.apple.com/verifyReceipt', { method: 'POST', body, headers: { 'content-type': 'application/json' } });
    j = await r.json();
  }
  if (j.status !== 0) {
    const e = new Error('Apple verifyReceipt failed: status ' + j.status);
    e.status = j.status;
    throw e;
  }
  // Pull the most recent active subscription
  const latest = (j.latest_receipt_info || []).reduce((best, t) =>
    (!best || +t.expires_date_ms > +best.expires_date_ms) ? t : best, null);
  return { receipt: j, latest };
}

router.post('/iap/verify', async (req, res) => {
  try {
    const { platform, productId, receipt } = req.body || {};
    if (platform !== 'ios') return res.status(400).json({ error: 'Only iOS supported here' });
    if (!receipt) return res.status(400).json({ error: 'receipt required' });
    const { latest } = await verifyAppleReceipt(receipt);
    if (!latest) return res.json({ entitled: false, source: 'apple' });
    const expiresAt = new Date(+latest.expires_date_ms);
    const active = expiresAt > new Date();
    const pool = req.app.locals.pool;
    if (pool) {
      await ensureTable(pool);
      await upsertEntitlement(pool, {
        workspace_id: req.user.ws,
        user_id: req.user.uid || null,
        source: 'apple',
        plan: productId,
        product_id: latest.product_id,
        external_id: latest.original_transaction_id,
        status: active ? 'active' : 'expired',
        expires_at: expiresAt,
        raw: latest,
      });
    }
    res.json({
      entitled: active,
      source: 'apple',
      plan: productId,
      productId: latest.product_id,
      expires: expiresAt.toISOString(),
      transactionId: latest.transaction_id,
    });
  } catch (e) {
    res.status(e.status === 21007 ? 400 : 502).json({ error: e.message });
  }
});

// ── Stripe Checkout (subscription) ──────────────────────────────────
router.post('/iap/checkout', async (req, res) => {
  if (!STRIPE_KEY) return res.status(503).json({ error: 'STRIPE_SECRET_KEY not configured' });
  const { priceId, productId } = req.body || {};
  if (!priceId) return res.status(400).json({ error: 'priceId required' });
  try {
    const wsId = req.user.ws;
    const r = await abortableFetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + STRIPE_KEY,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: form({
        mode: 'subscription',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        'success_url': APP_URL + '/Cortexx.html?iap=success&session_id={CHECKOUT_SESSION_ID}',
        'cancel_url': APP_URL + '/Cortexx.html?iap=cancel',
        'client_reference_id': wsId,
        'metadata[productId]': productId || priceId,
      }),
    });
    if (!r.ok) return res.status(502).json({ error: 'Stripe: ' + (await r.text()).slice(0, 200) });
    const j = await r.json();
    res.json({ url: j.url, sessionId: j.id });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ── Stripe billing portal ──────────────────────────────────────────
router.post('/iap/portal', async (req, res) => {
  if (!STRIPE_KEY) return res.status(503).json({ error: 'Stripe not configured' });
  const pool = req.app.locals.pool;
  if (!pool) return res.status(503).json({ error: 'no pool' });
  await ensureTable(pool);
  const wsId = req.user.ws;
  const row = await pool.query(`SELECT raw FROM iap_entitlements WHERE workspace_id=$1 AND source='stripe' ORDER BY updated_at DESC LIMIT 1`, [wsId]);
  const customer = row.rows[0] && row.rows[0].raw && row.rows[0].raw.customer;
  if (!customer) return res.status(404).json({ error: 'No Stripe customer for this workspace' });
  try {
    const r = await abortableFetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + STRIPE_KEY, 'content-type': 'application/x-www-form-urlencoded' },
      body: form({ customer, return_url: APP_URL + '/Cortexx.html' }),
    });
    if (!r.ok) return res.status(502).json({ error: 'Stripe portal: ' + (await r.text()).slice(0, 200) });
    const j = await r.json();
    res.json({ url: j.url });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.get('/iap/entitlement', async (req, res) => {
  const pool = req.app.locals.pool;
  if (!pool) return res.json({ entitled: false });
  await ensureTable(pool);
  const wsId = req.user.ws;
  const r = await pool.query(
    `SELECT source, plan, product_id, status, expires_at FROM iap_entitlements
     WHERE workspace_id=$1 AND status IN ('active','trialing') AND (expires_at IS NULL OR expires_at > now())
     ORDER BY expires_at DESC NULLS FIRST LIMIT 1`,
    [wsId]
  );
  if (!r.rows.length) return res.json({ entitled: false });
  const row = r.rows[0];
  res.json({
    entitled: true,
    source: row.source,
    plan: row.plan,
    productId: row.product_id,
    expires: row.expires_at,
  });
});

// ── Stripe webhook (subscription lifecycle) ─────────────────────────
// Mounted with express.raw() in server/index.js so req.body is a Buffer.
// This route is PUBLIC (Stripe → us, no Bearer token), so the signature is the
// ONLY thing that authenticates it. Fail closed if it can't be verified.
router.post('/iap/webhook', async (req, res) => {
  try {
    // If Stripe isn't configured on this server there is no integration to
    // service — ack and ignore rather than trusting an unauthenticated body.
    if (!STRIPE_KEY) return res.json({ ok: true, skipped: 'stripe not configured' });
    // req.body is a Buffer (raw). The signature is the only authenticator for
    // this public endpoint, so require the secret and a valid signature.
    if (!STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: 'STRIPE_WEBHOOK_SECRET not configured' });
    if (!verifyStripeSignature(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET)) {
      return res.status(400).json({ error: 'invalid signature' });
    }
    let event = null;
    try {
      const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      event = JSON.parse(raw);
    } catch { return res.status(400).json({ error: 'bad payload' }); }
    if (!event || !event.type || !event.data || !event.data.object) return res.status(400).json({ error: 'bad payload' });
    const pool = req.app.locals.pool;
    if (!pool) return res.json({ ok: true, skipped: 'no pool' });
    await ensureTable(pool);
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      const customer = s.customer; const sub = s.subscription; const wsId = s.client_reference_id || null;
      await upsertEntitlement(pool, {
        workspace_id: wsId, user_id: null, source: 'stripe',
        plan: (s.metadata && s.metadata.productId) || '', product_id: '',
        external_id: sub, status: 'active', expires_at: null,
        raw: { customer, sub, metadata: s.metadata },
      });
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const s = event.data.object;
      const expiresAt = s.current_period_end ? new Date(s.current_period_end * 1000) : null;
      const status = event.type === 'customer.subscription.deleted' ? 'canceled' : (s.status || 'active');
      await pool.query(
        `UPDATE iap_entitlements SET status=$1, expires_at=$2, updated_at=now() WHERE source='stripe' AND external_id=$3`,
        [status, expiresAt, s.id]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
