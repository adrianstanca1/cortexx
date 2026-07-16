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
// CORS: fail CLOSED. The API handles PII + financial data, so a wildcard '*'
// origin is unsafe even with Bearer auth (any leaked/token-replayed request from a
// victim's browser can be driven by a third-party site). Therefore:
//   - production: CORS_ORIGINS MUST be set, else we refuse to boot (mirrors the
//     JWT_SECRET prod guard below).
//   - development: default to a localhost allowlist instead of '*'.
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const DEV_DEFAULT_ORIGINS = ['http://localhost:8080', 'http://localhost:3000', 'http://127.0.0.1:8080'];
const effectiveOrigins = CORS_ORIGINS.length ? CORS_ORIGINS : DEV_DEFAULT_ORIGINS;
if (!CORS_ORIGINS.length && process.env.NODE_ENV === 'production') {
  console.error('[fatal] CORS_ORIGINS is not set. Refusing to start in production with a wildcard CORS policy.');
  process.exit(1);
}
const corsOptions = {
  origin: (origin, cb) => {
    // Same-origin / non-browser requests (no Origin header) are allowed.
    if (!origin) return cb(null, true);
    if (effectiveOrigins.includes(origin)) return cb(null, true);
    // Returning `false` (not an Error) makes cors set
    // Access-Control-Allow-Origin: false — the browser blocks the
    // response. Combined with the explicit 403 middleware below, the
    // signal to clients/monitors is correct and version-independent.
    return cb(null, false);
  },
  optionsSuccessStatus: 204,
};
// Explicit 403 for rejected origins (cors 2.x has no onError hook that
// runs for disallowed origins, so we intercept before cors replies).
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !effectiveOrigins.includes(origin)) {
    return res.status(403).json({ error: 'origin not allowed' });
  }
  next();
});
app.use(cors(corsOptions));
// Stripe webhook needs the RAW body for signature verification, so it must be
// parsed as a Buffer BEFORE the global JSON parser touches it.
app.use('/api/iap/webhook', express.raw({ type: '*/*', limit: '1mb' }));
app.use(express.json({ limit: '10mb' }));
// cookie-parser is needed by the Open Banking OAuth callback (state cookie).
// Optional dep — degrade gracefully if it isn't installed.
try { app.use(require('cookie-parser')()); } catch (e) { console.warn('[warn] cookie-parser not installed — bank OAuth state check disabled'); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// Expose the pool to route modules that read req.app.locals.pool
// (push, banking, iap, hmrc). Without this they silently fail.
app.locals.pool = pool;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
// Fail-fast in production: a missing JWT_SECRET must NEVER silently fall back to
// the hardcoded placeholder — that would let anyone forge tokens for any
// user/workspace (full auth bypass). banking.js also derives the bank-token
// encryption key from JWT_SECRET, so this guard protects token-at-rest too.
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('[fatal] JWT_SECRET is not set. Refusing to start in production with the insecure default.');
  process.exit(1);
}
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

// The integration routers (banking/hmrc/iap/llm/payments/push) export a plain
// express.Router() and never received `auth`, leaving them fully unauthenticated.
// Gate every one of their endpoints behind `auth` EXCEPT the few that physically
// cannot carry a Bearer token (server-to-server webhook / top-level OAuth redirect
// / the public VAPID key). Those do their own verification.
const INTEGRATION_PUBLIC = new Set([
  'GET /banking/callback',   // TrueLayer OAuth redirect (browser top-level navigation)
  'POST /iap/webhook',       // Stripe webhook — signature-verified inside iap.js
  'GET /push/vapid',         // public VAPID key, safe to expose
]);
function integrationAuth(req, res, next) {
  // req.path is relative to the '/api' mount point here (e.g. '/banking/callback').
  if (INTEGRATION_PUBLIC.has(req.method + ' ' + req.path)) return next();
  return auth(req, res, next);
}

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
// Cap concurrent SSE connections per workspace so one valid JWT can't open
// unbounded sockets (each holds a connection + a 25s ping interval + a Map
// entry) and exhaust FDs/memory.
const MAX_STREAMS_PER_WS = 12;
app.get('/api/stream', apiLimiter, wrap(async (req, res) => {
  let ws;
  try { ws = jwt.verify(req.query.token || '', JWT_SECRET).ws; }
  catch { return res.status(401).end(); }
  const key = String(ws);
  if ((channels.get(key)?.size || 0) >= MAX_STREAMS_PER_WS) {
    return res.status(429).set('Retry-After', '5').json({ error: 'too_many_streams' });
  }
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
  if (!channels.has(key)) channels.set(key, new Set());
  channels.get(key).add(res);
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) {} }, 25000);
  req.on('close', () => { clearInterval(ping); channels.get(key)?.delete(res); });
}));

// ── Health (public; MUST be before /api/:collection or auth shadows it) ─────
app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: Date.now(), streams: [...channels.values()].reduce((n, s) => n + s.size, 0) }));

// ── Public support ticket submission (registered BEFORE the /api router
//    mounts below, otherwise the auth-gated `sync` router shadows this path
//    and forces a 401 on anonymous submissions) ─────────────────────────────
app.post('/api/support/tickets', authLimiter, wrap(async (req, res) => {
  const { name, email, subject, message, priority } = req.body;
  if (!name || !email || !subject || !message)
    return res.status(400).json({ error: 'name, email, subject, message required' });
  const safePriority = ['low', 'normal', 'high', 'urgent'].includes(priority) ? priority : 'normal';
  // Best-effort link to the submitting user's workspace (if logged in).
  let wsId = null;
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try { const u = jwt.verify(token, JWT_SECRET); wsId = u.ws; } catch { /* anonymous OK */ }
  const r = await pool.query(
    `INSERT INTO support_tickets(name, email, subject, message, priority, workspace_id)
     VALUES($1,$2,$3,$4,$5,$6) RETURNING id, status`,
    [name, email, subject, message, safePriority, wsId]);
  res.json({ id: r.rows[0].id, status: r.rows[0].status });
}));

// ── Mounted route modules (MUST be before the generic /api/:collection
//    handlers below, or Express would shadow these specific paths) ──────────
app.use('/api/portal', portalLimiter, require('./routes/portal')(pool, bus));   // PUBLIC, token-scoped
app.use('/api', apiLimiter, require('./routes/sync')(pool, auth));               // sync + portal inbox
app.use('/api', apiLimiter, require('./routes/ledger')(pool, auth));            // ledger CSV
app.use('/api', apiLimiter, require('./routes/agents')(pool, auth, bus));                    // AI triage + inbound webhooks (rate-limited; /triage calls a paid upstream)
app.use('/api', apiLimiter, integrationAuth, require('./routes/llm'));           // local LLM (Ollama/OpenAI-compat) — replaces third-party API
app.use('/api', apiLimiter, integrationAuth, require('./routes/payments'));      // Stripe / GoCardless / bank-transfer link generation
app.use('/api', apiLimiter, integrationAuth, require('./routes/push'));          // Web Push (VAPID) + native APNs/FCM passthrough
app.use('/api', apiLimiter, integrationAuth, require('./routes/banking'));       // Open Banking (TrueLayer) — auto-pull bank statements
app.use('/api', apiLimiter, integrationAuth, require('./routes/iap'));           // In-app subscriptions (StoreKit + Stripe Checkout)
app.use('/api', apiLimiter, integrationAuth, require('./routes/hmrc'));          // HMRC Transaction Engine (CIS300 + GovTalk envelope)
app.use('/api', apiLimiter, require('./routes/intelligence')(pool, auth));       // v1.7 server-side intelligence (7 domains)

// ── Generic collection REST (mirrors frontend Backend.db.*) ──
// Typed collections — these have first-class DB tables. Anything else falls
// through to the generic `documents_store` JSON catch-all.
const NATIVE = new Set([
  'projects', 'tasks', 'team', 'team_members', 'invoices', 'quotes',
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
    // Optional pagination — default is unbounded to preserve the SPA's full-sync
    // model, but callers can pass ?limit=&?offset= to page large collections.
    const lim = Math.min(Math.max(parseInt(req.query.limit, 10) || 0, 0), 5000);
    const off = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const page = lim ? ` LIMIT ${lim} OFFSET ${off}` : '';
    const r = await pool.query(`SELECT * FROM ${tbl} WHERE workspace_id=$1 ORDER BY ${orderCol} DESC NULLS LAST${page}`, [req.user.ws]);
    // Merge the JSONB `data` blob over the typed columns, drop internal bookkeeping.
    return res.json(r.rows.map(row => {
      const { data, workspace_id, ...cols } = row;
      return { ...cols, ...(data || {}) };
    }));
  }
  const r = await pool.query('SELECT doc_id, data FROM documents_store WHERE workspace_id=$1 AND collection=$2', [req.user.ws, collection]);
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
       ON CONFLICT (id) DO UPDATE SET data=$3, updated_at=now()`,
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
       ON CONFLICT (id) DO UPDATE SET data=$3, updated_at=now()`,
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

// ── Admin console (SaaS operator) ──────────────────────────
// Reuse the existing `auth` middleware, then require an operator role.
// The JWT payload only carries {uid, ws} (see signToken), so we resolve the
// live role from the DB — this also reflects role changes immediately.
async function adminAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    const u = jwt.verify(token, JWT_SECRET);
    const r = await pool.query('SELECT role FROM users WHERE id=$1', [u.uid]);
    if (!r.rows[0] || !['owner', 'admin'].includes(r.rows[0].role))
      return res.status(403).json({ error: 'forbidden' });
    req.user = u;
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}

// Platform overview: tenant/user/project counts + today's activity.
app.get('/api/admin/overview', apiLimiter, adminAuth, wrap(async (req, res) => {
  const [ws, us, pr, proj7, ticks] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS n FROM workspaces'),
    pool.query('SELECT COUNT(*)::int AS n FROM users'),
    pool.query('SELECT COUNT(*)::int AS n FROM projects'),
    pool.query("SELECT COUNT(*)::int AS n FROM projects WHERE created_at > now() - interval '7 days'"),
    pool.query("SELECT COUNT(*)::int AS n FROM support_tickets WHERE status IN ('open','in_progress')"),
  ]);
  res.json({
    workspaces: ws.rows[0].n,
    users: us.rows[0].n,
    projects: pr.rows[0].n,
    new_projects_7d: proj7.rows[0].n,
    open_tickets: ticks.rows[0].n,
  });
}));

// Tenant (workspace) directory.
app.get('/api/admin/workspaces', apiLimiter, adminAuth, wrap(async (req, res) => {
  const r = await pool.query(`
    SELECT w.id, w.name, w.company, w.plan, w.suspended, w.created_at,
           (SELECT COUNT(*) FROM users u WHERE u.workspace_id = w.id) AS users,
           (SELECT COUNT(*) FROM projects p WHERE p.workspace_id = w.id) AS projects
    FROM workspaces w ORDER BY w.created_at DESC LIMIT 200`);
  res.json({ workspaces: r.rows });
}));

// User directory.
app.get('/api/admin/users', apiLimiter, adminAuth, wrap(async (req, res) => {
  const r = await pool.query(`
    SELECT u.id, u.name, u.email, u.role, u.created_at, w.name AS workspace
    FROM users u LEFT JOIN workspaces w ON w.id = u.workspace_id
    ORDER BY u.created_at DESC LIMIT 200`);
  res.json({ users: r.rows });
}));

// Support tickets — admin list.
app.get('/api/admin/support/tickets', apiLimiter, adminAuth, wrap(async (req, res) => {
  const r = await pool.query(`
    SELECT id, name, email, subject, priority, status, created_at
    FROM support_tickets ORDER BY created_at DESC LIMIT 200`);
  res.json({ tickets: r.rows });
}));

// Support ticket — admin status update.
app.patch('/api/admin/support/tickets/:id', apiLimiter, adminAuth, wrap(async (req, res) => {
  const { status } = req.body;
  if (!['open', 'in_progress', 'resolved', 'closed'].includes(status))
    return res.status(400).json({ error: 'bad_status' });
  const r = await pool.query(
    "UPDATE support_tickets SET status=$2, updated_at=now() WHERE id=$1 RETURNING *",
    [req.params.id, status]);
  if (!r.rows[0]) return res.status(404).json({ error: 'not_found' });
  res.json({ ticket: r.rows[0] });
}));

// Tenant suspend / activate (operator action; does not delete data).
app.patch('/api/admin/workspaces/:id', apiLimiter, adminAuth, wrap(async (req, res) => {
  const suspended = !!req.body.suspended;
  const r = await pool.query(
    "UPDATE workspaces SET suspended=$2 WHERE id=$1 RETURNING id, name, suspended",
    [req.params.id, suspended]);
  if (!r.rows[0]) return res.status(404).json({ error: 'not_found' });
  res.json({ workspace: r.rows[0] });
}));

// ── Public support ticket lookup (self-service, by email) ────
app.post('/api/support/tickets/lookup', authLimiter, wrap(async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@'))
    return res.status(400).json({ error: 'valid email required' });
  const r = await pool.query(
    `SELECT id, subject, priority, status, created_at, updated_at
     FROM support_tickets WHERE email=$1 ORDER BY created_at DESC LIMIT 50`,
    [email.toLowerCase()]);
  res.json({ tickets: r.rows });
}));

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
