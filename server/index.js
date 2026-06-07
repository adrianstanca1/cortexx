// Cortexx API — Express + PostgreSQL
// Production backend that mirrors the frontend Backend.db.* collections,
// plus client-portal, sync, realtime (SSE), magic-link auth and ledger CSV.
// Run: npm install && node server/index.js  (needs DATABASE_URL env)

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
// cookie-parser is needed by the Open Banking OAuth callback (state cookie).
// Optional dep — degrade gracefully if it isn't installed.
try { app.use(require('cookie-parser')()); } catch (e) { console.warn('[warn] cookie-parser not installed — bank OAuth state check disabled'); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// Expose the pool to route modules that read req.app.locals.pool
// (push, banking, iap, hmrc). Without this they silently fail.
app.locals.pool = pool;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const APP_URL = process.env.APP_URL || 'http://localhost:8080';

// ── Rate limits ─────────────────────────────────────────────
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
const portalLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

// ── Realtime bus (Server-Sent Events, per workspace) ────────
const channels = new Map(); // workspace_id -> Set<res>
const bus = {
  emit(ws, payload) {
    const set = channels.get(String(ws));
    if (!set) return;
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of set) { try { res.write(data); } catch (e) {} }
  },
};

// ── Auth middleware ─────────────────────────────────────────
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'unauthorized' }); }
}
const signToken = (uid, ws) => jwt.sign({ uid, ws }, JWT_SECRET, { expiresIn: '30d' });
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ── Auth routes ─────────────────────────────────────────────
app.post('/api/auth/register', authLimiter, wrap(async (req, res) => {
  const { name, email, password, company } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
  const exists = await pool.query('SELECT 1 FROM users WHERE email=$1', [email]);
  if (exists.rows[0]) return res.status(409).json({ error: 'email_in_use' });
  const ws = await pool.query('INSERT INTO workspaces(name, company) VALUES($1,$2) RETURNING id', [company || name, company]);
  const hash = await bcrypt.hash(password, 10);
  const user = await pool.query(
    'INSERT INTO users(workspace_id, name, email, password_hash) VALUES($1,$2,$3,$4) RETURNING id, workspace_id, name, email, role',
    [ws.rows[0].id, name, email, hash]
  );
  res.json({ token: signToken(user.rows[0].id, ws.rows[0].id), user: user.rows[0] });
}));

app.post('/api/auth/login', authLimiter, wrap(async (req, res) => {
  const { email, password } = req.body;
  const r = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
  if (!r.rows[0] || !r.rows[0].password_hash || !(await bcrypt.compare(password, r.rows[0].password_hash)))
    return res.status(401).json({ error: 'invalid credentials' });
  const u = r.rows[0];
  res.json({ token: signToken(u.id, u.workspace_id), user: { id: u.id, name: u.name, email: u.email, role: u.role } });
}));

// Validate a token and return the current user (used by the client on boot).
app.get('/api/auth/me', apiLimiter, auth, wrap(async (req, res) => {
  const r = await pool.query('SELECT id, name, email, role, workspace_id FROM users WHERE id=$1', [req.user.uid]);
  if (!r.rows[0]) return res.status(404).json({ error: 'not_found' });
  res.json({ user: r.rows[0] });
}));

// ── Magic-link (passwordless) auth ──────────────────────────
app.post('/api/auth/magic/request', authLimiter, wrap(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  const u = await pool.query('SELECT workspace_id FROM users WHERE email=$1', [email]);
  const token = crypto.randomBytes(24).toString('base64url');
  const expires = new Date(Date.now() + 15 * 60 * 1000);
  await pool.query('INSERT INTO magic_links(token, email, workspace_id, expires_at) VALUES($1,$2,$3,$4)',
    [token, email, u.rows[0]?.workspace_id || null, expires]);
  const link = `${APP_URL}/?magic=${token}`;
  // Deliver via Resend if configured; otherwise log (and in dev, return the link).
  let sent = false;
  if (process.env.RESEND_API_KEY) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: process.env.MAIL_FROM || 'CortexBuild Pro <login@cortexbuildpro.com>',
          to: [email],
          subject: 'Your CortexBuild Pro sign-in link',
          html: `<p>Tap to sign in (expires in 15 minutes):</p><p><a href="${link}">Sign in to CortexBuild Pro</a></p><p>If you didn't request this, ignore this email.</p>`,
        }),
      });
      sent = r.ok;
      if (!r.ok) console.error('[magic] resend failed', await r.text());
    } catch (e) { console.error('[magic] resend error', e.message); }
  } else {
    console.log(`[magic] (no mailer configured) ${email} → ${link}`);
  }
  // In production, never leak the link in the response. In dev, return it.
  if (process.env.NODE_ENV === 'production') return res.json({ ok: true, sent });
  res.json({ ok: true, sent, devLink: link });
}));

app.post('/api/auth/magic/verify', authLimiter, wrap(async (req, res) => {
  const { token } = req.body;
  const r = await pool.query('SELECT * FROM magic_links WHERE token=$1', [token]);
  const link = r.rows[0];
  if (!link || link.used || new Date(link.expires_at) < new Date())
    return res.status(400).json({ error: 'invalid_or_expired' });
  await pool.query('UPDATE magic_links SET used=true WHERE token=$1', [token]);
  let u = await pool.query('SELECT * FROM users WHERE email=$1', [link.email]);
  if (!u.rows[0]) {
    const ws = await pool.query('INSERT INTO workspaces(name) VALUES($1) RETURNING id', [link.email.split('@')[0]]);
    u = await pool.query('INSERT INTO users(workspace_id, name, email, password_hash) VALUES($1,$2,$3,$4) RETURNING *',
      [ws.rows[0].id, link.email.split('@')[0], link.email, '']);
  }
  const user = u.rows[0];
  res.json({ token: signToken(user.id, user.workspace_id), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

// ── Realtime stream ─────────────────────────────────────────
app.get('/api/stream', wrap(async (req, res) => {
  let ws;
  try { ws = jwt.verify(req.query.token || '', JWT_SECRET).ws; }
  catch { return res.status(401).end(); }
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
  const key = String(ws);
  if (!channels.has(key)) channels.set(key, new Set());
  channels.get(key).add(res);
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) {} }, 25000);
  req.on('close', () => { clearInterval(ping); channels.get(key)?.delete(res); });
}));

// ── Mounted route modules (MUST be before the generic /api/:collection
//    handlers below, or Express would shadow these specific paths) ──────────
app.use('/api/portal', portalLimiter, require('./routes/portal')(pool, bus));   // PUBLIC, token-scoped
app.use('/api', apiLimiter, require('./routes/sync')(pool, auth));               // sync + portal inbox
app.use('/api', apiLimiter, require('./routes/ledger')(pool, auth));            // ledger CSV
app.use('/api', require('./routes/agents')(pool, auth, bus));                    // AI triage + inbound webhooks
app.use('/api', apiLimiter, require('./routes/llm'));                            // local LLM (Ollama/OpenAI-compat) — replaces third-party API
app.use('/api', apiLimiter, require('./routes/payments'));                       // Stripe / GoCardless / bank-transfer link generation
app.use('/api', apiLimiter, require('./routes/push'));                           // Web Push (VAPID) + native APNs/FCM passthrough
app.use('/api', apiLimiter, require('./routes/banking'));                        // Open Banking (TrueLayer) — auto-pull bank statements
app.use('/api', apiLimiter, require('./routes/iap'));                            // In-app subscriptions (StoreKit + Stripe Checkout)
app.use('/api', apiLimiter, require('./routes/hmrc'));                           // HMRC Transaction Engine (CIS300 + GovTalk envelope)

// ── Generic collection REST (mirrors frontend Backend.db.*) ──
// Typed collections — these have first-class DB tables. Anything else falls
// through to the generic `documents_store` JSON catch-all.
const NATIVE = new Set([
  'projects', 'tasks', 'team', 'team_members', 'invoices', 'quotes', 'photos',
  // v1.3 gap closure (all use TEXT id + data JSONB)
  'receipts', 'cisSubs', 'cisPayments', 'timesheets', 'diary',
  'snags', 'changeOrders', 'rfis', 'subs', 'materials',
  'documentsMeta', 'equipment', 'notifications', 'siteMaps',
  // NOTE: 'activity' intentionally excluded — activity_log uses a BIGSERIAL id
  // (not the TEXT-id + JSONB write shape), so it lives in documents_store like
  // the other ~36 lighter collections. Keeps read/write paths consistent.
]);

// camelCase collection name → snake_case table name
const TABLE_NAMES = {
  team:           'team_members',
  cisSubs:        'cis_subs',
  cisPayments:    'cis_payments',
  changeOrders:   'change_orders',
  diary:          'diary_entries',
  documentsMeta:  'documents_meta',
  activity:       'activity_log',
  siteMaps:       'site_maps',
};
const tableFor = (c) => TABLE_NAMES[c] || c;

app.get('/api/:collection', apiLimiter, auth, wrap(async (req, res) => {
  const { collection } = req.params;
  if (NATIVE.has(collection)) {
    const tbl = tableFor(collection);
    // Order by a column each table actually has (many lack created_at).
    const ORDER = {
      projects: 'created_at', tasks: 'created_at',
      invoices: 'issued', quotes: 'issued',
      team: 'name', team_members: 'name',
      activity: 'at', notifications: 'created_at',
    };
    let orderCol = ORDER[collection];
    if (!orderCol) orderCol = ['receipts','cisSubs','cisPayments','timesheets','diary','snags','changeOrders','rfis','subs','materials','documentsMeta','equipment','siteMaps'].includes(collection) ? 'updated_at' : 'id';
    const r = await pool.query(`SELECT * FROM ${tbl} WHERE workspace_id=$1 ORDER BY ${orderCol} DESC NULLS LAST LIMIT 100`, [req.user.ws]);
    // Merge the JSONB `data` blob over the typed columns, drop internal bookkeeping.
    return res.json(r.rows.map(row => {
      const { data, workspace_id, ...cols } = row;
      return { ...cols, ...(data || {}) };
    }));
  }
  const r = await pool.query('SELECT doc_id, data FROM documents_store WHERE workspace_id=$1 AND collection=$2 LIMIT 100', [req.user.ws, collection]);
  res.json(r.rows.map(row => ({ id: row.doc_id, ...row.data })));
}));

// Tables that have a TEXT id + data JSONB shape (v1.3 gap closure schema)
const TYPED_JSONB = new Set([
  'receipts','cisSubs','cisPayments','timesheets','diary','snags','changeOrders',
  'rfis','subs','materials','documentsMeta','equipment','notifications','siteMaps',
]);

app.post('/api/:collection', apiLimiter, auth, wrap(async (req, res) => {
  const { collection } = req.params;
  const docId = req.body.id || crypto.randomUUID();
  if (TYPED_JSONB.has(collection)) {
    const tbl = tableFor(collection);
    await pool.query(
      `INSERT INTO ${tbl} (id, workspace_id, data) VALUES ($1,$2,$3)
       ON CONFLICT (id) DO UPDATE SET data=$3, updated_at=now() WHERE ${tbl}.workspace_id=$2`,
      [docId, req.user.ws, req.body]
    );
    bus.emit(req.user.ws, { type: 'change', collection, op: 'create', id: docId });
    return res.json({ id: docId, ...req.body });
  }
  await pool.query(
    `INSERT INTO documents_store(workspace_id, collection, doc_id, data) VALUES($1,$2,$3,$4)
     ON CONFLICT (workspace_id, collection, doc_id) DO UPDATE SET data=$4, updated_at=now()`,
    [req.user.ws, collection, docId, req.body]
  );
  bus.emit(req.user.ws, { type: 'change', collection, op: 'create', id: docId });
  res.json({ id: docId, ...req.body });
}));

app.put('/api/:collection/:id', apiLimiter, auth, wrap(async (req, res) => {
  const { collection, id } = req.params;
  if (TYPED_JSONB.has(collection)) {
    const tbl = tableFor(collection);
    await pool.query(
      `INSERT INTO ${tbl} (id, workspace_id, data) VALUES ($1,$2,$3)
       ON CONFLICT (id) DO UPDATE SET data=$3, updated_at=now() WHERE ${tbl}.workspace_id=$2`,
      [id, req.user.ws, { ...req.body, id }]
    );
    bus.emit(req.user.ws, { type: 'change', collection, op: 'update', id });
    return res.json({ id, ...req.body });
  }
  await pool.query(
    `INSERT INTO documents_store(workspace_id, collection, doc_id, data) VALUES($1,$2,$3,$4)
     ON CONFLICT (workspace_id, collection, doc_id) DO UPDATE SET data=$4, updated_at=now()`,
    [req.user.ws, collection, id, { ...req.body, id }]
  );
  bus.emit(req.user.ws, { type: 'change', collection, op: 'update', id });
  res.json({ id, ...req.body });
}));

app.delete('/api/:collection/:id', apiLimiter, auth, wrap(async (req, res) => {
  const { collection, id } = req.params;
  if (TYPED_JSONB.has(collection)) {
    const tbl = tableFor(collection);
    await pool.query(`DELETE FROM ${tbl} WHERE id=$1 AND workspace_id=$2`, [id, req.user.ws]);
    bus.emit(req.user.ws, { type: 'change', collection, op: 'delete', id });
    return res.json({ ok: true });
  }
  await pool.query('DELETE FROM documents_store WHERE workspace_id=$1 AND collection=$2 AND doc_id=$3', [req.user.ws, collection, id]);
  bus.emit(req.user.ws, { type: 'change', collection, op: 'delete', id });
  res.json({ ok: true });
}));

// ── AI proxy (local-first: Ollama; Anthropic only if a key is present) ──
app.post('/api/ai', apiLimiter, auth, wrap(async (req, res) => {
  const messages = req.body.messages || [];
  let text = '';
  if (process.env.ANTHROPIC_API_KEY) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 1024, messages }),
    });
    const data = await r.json();
    text = data.content?.[0]?.text || '';
  } else {
    // No third-party key — route through the local LLM (Ollama / OpenAI-compat).
    try { text = await require('./routes/llm').chat(messages); }
    catch (e) { return res.status(502).json({ error: 'local LLM unavailable: ' + e.message }); }
  }
  await pool.query('INSERT INTO ai_history(workspace_id, user_msg, ai_reply) VALUES($1,$2,$3)',
    [req.user.ws, messages?.[0]?.content?.slice(0, 500), text]);
  res.json({ text });
}));

// ── Audit (hash-chained) ────────────────────────────────────
app.post('/api/audit', apiLimiter, auth, wrap(async (req, res) => {
  const prev = await pool.query('SELECT hash FROM audit_log WHERE workspace_id=$1 ORDER BY id DESC LIMIT 1', [req.user.ws]);
  const prevHash = prev.rows[0]?.hash || '';
  const { actor, action, target } = req.body;
  const hash = crypto.createHash('sha256').update(prevHash + actor + action + target + Date.now()).digest('hex');
  await pool.query('INSERT INTO audit_log(workspace_id, actor, action, target, hash) VALUES($1,$2,$3,$4,$5)',
    [req.user.ws, actor, action, target, hash]);
  res.json({ ok: true, hash });
}));

// ── Mounted route modules ───────────────────────────────────
// (mounted above, before the generic /api/:collection handlers)

app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: Date.now(), streams: [...channels.values()].reduce((n, s) => n + s.size, 0) }));

// ── 404 + error handler ─────────────────────────────────────
app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: 'server_error' });
});

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => console.log(`Cortexx API on :${PORT}`));

// ── Graceful shutdown ───────────────────────────────────────
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`\n${sig} received — closing`);
    server.close(() => pool.end().then(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
