// CortexBuild Pro — HMRC CIS300 submission via Government Gateway (v1.3)
//
// Wraps the IRenvelope produced by lib/cis300.js in a GovTalkMessage and
// POSTs it through HMRC's Transaction Engine using async polling.
//
// Pipeline:
//   1. POST   /submission     with <Class>IR-CIS-CIS300MR</Class> + body
//      → 202 + correlation_id   (the "submission" stage)
//   2. POLL   /submission with the correlation_id every 5s (HMRC says ≥ 5s)
//      → status: 'acknowledgement' (still processing)
//             or 'response' (success)
//             or 'error' (rejection — body has Error blocks)
//   3. DELETE /submission with the correlation_id once done (cleanup)
//
// Endpoints:
//   /api/hmrc/cis300/submit  — kick off submission (returns correlation_id)
//   /api/hmrc/cis300/status  — poll status by correlation_id
//   /api/hmrc/cis300/history — list past submissions for the workspace
//
// Honest caveat: requires HMRC Online Services account + Gateway credentials.
// Test these against HMRC's TPVS (Third-Party Validation Service) URL first.

const express = require('express');
const router = express.Router();

const GW_USER = process.env.HMRC_GATEWAY_USER || '';
const GW_PASS = process.env.HMRC_GATEWAY_PASS || '';
const VENDOR_ID = process.env.HMRC_VENDOR_ID || '0000';
const PRODUCT = 'CortexBuild Pro';
const VERSION = '1.0.0';
const HMRC_ENV = (process.env.HMRC_ENV || 'tpvs').toLowerCase();  // 'tpvs' | 'live'
const HMRC_URL = HMRC_ENV === 'live'
  ? 'https://transaction-engine.tax.service.gov.uk/submission'
  : 'https://test-transaction-engine.tax.service.gov.uk/submission';

const CONFIGURED = !!(GW_USER && GW_PASS);

function abortableFetch(url, opts, ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms || 30000);
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
}

function xmlEscape(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;' }[c]));
}

// ── Build the GovTalkMessage envelope wrapping an IRenvelope ────────
function wrapGovTalkRequest(body, opts) {
  // opts: { className, correlationId, periodEnd }
  const className = opts.className || 'IR-CIS-CIS300MR';
  const correlationId = opts.correlationId || '';
  const qualifier = opts.qualifier || 'request';
  const fn = opts.function || (correlationId ? 'submit' : 'submit');  // same — but explicit

  // Authentication block — login is base64-encoded password per HMRC spec
  const auth = `
    <SenderDetails>
      <IDAuthentication>
        <SenderID>${xmlEscape(GW_USER)}</SenderID>
        <Authentication>
          <Method>clear</Method>
          <Role>principal</Role>
          <Value>${xmlEscape(GW_PASS)}</Value>
        </Authentication>
      </IDAuthentication>
    </SenderDetails>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<GovTalkMessage xmlns="http://www.govtalk.gov.uk/CM/envelope">
  <EnvelopeVersion>2.0</EnvelopeVersion>
  <Header>
    <MessageDetails>
      <Class>${xmlEscape(className)}</Class>
      <Qualifier>${xmlEscape(qualifier)}</Qualifier>
      <Function>${xmlEscape(fn)}</Function>
      ${correlationId ? `<CorrelationID>${xmlEscape(correlationId)}</CorrelationID>` : ''}
      <Transformation>XML</Transformation>
      <GatewayTest>${HMRC_ENV === 'live' ? 'false' : 'true'}</GatewayTest>
    </MessageDetails>
    ${auth}
  </Header>
  <GovTalkDetails>
    <Keys/>
    <ChannelRouting>
      <Channel>
        <URI>${xmlEscape(VENDOR_ID)}</URI>
        <Product>${xmlEscape(PRODUCT)}</Product>
        <Version>${xmlEscape(VERSION)}</Version>
      </Channel>
    </ChannelRouting>
  </GovTalkDetails>
  <Body>${body}</Body>
</GovTalkMessage>`;
}

// Poll-only message (no body — just correlation id)
function pollEnvelope(correlationId, className) {
  return wrapGovTalkRequest('', { className: className || 'IR-CIS-CIS300MR', correlationId, qualifier: 'poll', function: 'submit' });
}
// Delete (cleanup) message
function deleteEnvelope(correlationId, className) {
  return wrapGovTalkRequest('', { className: className || 'IR-CIS-CIS300MR', correlationId, qualifier: 'request', function: 'delete' });
}

// ── Parse minimal fields from a GovTalk response ─────────────────
function parseGovTalkResponse(xml) {
  const out = { raw: xml };
  const q = xml.match(/<Qualifier>([^<]+)<\/Qualifier>/);
  if (q) out.qualifier = q[1];
  const c = xml.match(/<CorrelationID>([^<]+)<\/CorrelationID>/);
  if (c) out.correlationId = c[1];
  const e = xml.match(/<Endpoint(?:[^>]*?PollInterval="(\d+)")?[^>]*>([^<]+)<\/Endpoint>/);
  if (e) { out.pollInterval = e[1] ? +e[1] : null; out.endpoint = e[2]; }
  // Errors
  const errs = [...xml.matchAll(/<Error>([\s\S]*?)<\/Error>/g)].map(m => {
    const inner = m[1];
    const num = (inner.match(/<Number>([^<]+)<\/Number>/) || [])[1];
    const txt = (inner.match(/<Text>([^<]+)<\/Text>/) || [])[1];
    return { number: num, text: txt };
  });
  if (errs.length) out.errors = errs;
  return out;
}

// ── Store submissions in DB ─────────────────────────────────────
async function ensureTable(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS hmrc_submissions (
    id              SERIAL PRIMARY KEY,
    workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id         TEXT,
    class_name      TEXT NOT NULL,
    correlation_id  TEXT,
    period_end      DATE,
    status          TEXT,           -- 'submitted' | 'polling' | 'accepted' | 'rejected' | 'error'
    poll_interval   INTEGER,
    next_poll_at    TIMESTAMPTZ,
    request_xml     TEXT,
    response_xml    TEXT,
    errors          JSONB,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_hmrc_ws ON hmrc_submissions(workspace_id, created_at DESC)`);
}

// ── Routes ──────────────────────────────────────────────────────
router.get('/hmrc/status', (_req, res) => {
  res.json({
    configured: CONFIGURED,
    env: HMRC_ENV,
    url: HMRC_URL,
    senderConfigured: !!GW_USER,
    vendorId: VENDOR_ID,
  });
});

router.post('/hmrc/cis300/submit', async (req, res) => {
  try {
    if (!CONFIGURED) return res.status(503).json({ error: 'HMRC Gateway credentials not configured — set HMRC_GATEWAY_USER + HMRC_GATEWAY_PASS' });
    const body = req.body && req.body.irEnvelope;
    const periodEnd = (req.body && req.body.periodEnd) || '';
    if (!body || !body.includes('<IRenvelope')) return res.status(400).json({ error: 'irEnvelope required (the body from CortexCIS300.toHMRCXml)' });

    const envelope = wrapGovTalkRequest(body, { className: 'IR-CIS-CIS300MR' });
    const r = await abortableFetch(HMRC_URL, {
      method: 'POST',
      headers: { 'content-type': 'text/xml; charset=utf-8', accept: 'text/xml' },
      body: envelope,
    });
    const text = await r.text();
    const parsed = parseGovTalkResponse(text);
    const pool = req.app.locals.pool;
    if (pool) {
      await ensureTable(pool);
      await pool.query(
        `INSERT INTO hmrc_submissions (workspace_id, user_id, class_name, correlation_id, period_end, status, poll_interval, next_poll_at, request_xml, response_xml, errors)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          (req.user && req.user.ws) || null,
          (req.user && req.user.id) || null,
          'IR-CIS-CIS300MR',
          parsed.correlationId || null,
          periodEnd || null,
          parsed.errors ? 'rejected' : (parsed.qualifier === 'acknowledgement' ? 'polling' : 'submitted'),
          parsed.pollInterval,
          parsed.pollInterval ? new Date(Date.now() + parsed.pollInterval * 1000) : null,
          envelope,
          text,
          parsed.errors ? parsed.errors : null,
        ]
      );
    }
    res.json({
      correlationId: parsed.correlationId,
      qualifier: parsed.qualifier,
      pollInterval: parsed.pollInterval,
      endpoint: parsed.endpoint,
      errors: parsed.errors,
      env: HMRC_ENV,
    });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.get('/hmrc/cis300/status', async (req, res) => {
  try {
    if (!CONFIGURED) return res.status(503).json({ error: 'HMRC not configured' });
    const correlationId = req.query.correlationId;
    if (!correlationId) return res.status(400).json({ error: 'correlationId required' });
    const envelope = pollEnvelope(correlationId);
    const r = await abortableFetch(HMRC_URL, {
      method: 'POST',
      headers: { 'content-type': 'text/xml; charset=utf-8', accept: 'text/xml' },
      body: envelope,
    });
    const text = await r.text();
    const parsed = parseGovTalkResponse(text);
    const status = parsed.errors ? 'rejected' : (parsed.qualifier === 'response' ? 'accepted' : 'polling');
    const pool = req.app.locals.pool;
    if (pool) {
      await ensureTable(pool);
      await pool.query(
        `UPDATE hmrc_submissions SET status=$1, response_xml=$2, errors=$3, updated_at=now()
         WHERE correlation_id=$4`,
        [status, text, parsed.errors ? parsed.errors : null, correlationId]
      );
    }
    res.json({ status, qualifier: parsed.qualifier, errors: parsed.errors, correlationId });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.delete('/hmrc/cis300/submission', async (req, res) => {
  try {
    if (!CONFIGURED) return res.status(503).json({ error: 'HMRC not configured' });
    const correlationId = req.query.correlationId;
    if (!correlationId) return res.status(400).json({ error: 'correlationId required' });
    const envelope = deleteEnvelope(correlationId);
    const r = await abortableFetch(HMRC_URL, {
      method: 'POST',
      headers: { 'content-type': 'text/xml; charset=utf-8', accept: 'text/xml' },
      body: envelope,
    });
    const text = await r.text();
    res.json({ ok: true, response: parseGovTalkResponse(text) });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.get('/hmrc/cis300/history', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    if (!pool) return res.json({ submissions: [] });
    await ensureTable(pool);
    const wsId = (req.user && req.user.ws) || null;
    const r = await pool.query(
      `SELECT id, correlation_id, period_end, status, errors, created_at, updated_at
       FROM hmrc_submissions WHERE workspace_id=$1 OR workspace_id IS NULL
       ORDER BY created_at DESC LIMIT 50`,
      [wsId]
    );
    res.json({ submissions: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
