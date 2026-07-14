// Cortexx API — AI agent routes (v1.4)
// Mounted at /api. Server-side triage + inbound webhooks for WhatsApp and email.
// Point your WA Business API / email-forwarding provider at the webhook URLs and
// inbound messages become leads automatically.

const express = require('express');
const crypto = require('crypto');

// Small Claude helper (server holds the key).
async function claude(messages) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 800, messages }),
  });
  const data = await r.json();
  return data.content?.[0]?.text || '';
}
const grab = (raw) => { try { const m = raw.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch (e) { return null; } };

async function triage(text) {
  const prompt = `You triage inbound messages for a UK SMB construction company. Classify and extract.
Reply ONLY JSON: {"category":"lead|invoice|enquiry|supplier|complaint|other","confidence":0-1,"summary":"1 sentence","extract":{"name":"person/company or null","value":"GBP number or null","inquiry":"scope or null"}}.
Message: """${(text || '').slice(0, 4000)}"""`;
  return grab(await claude([{ role: 'user', content: prompt }]));
}

module.exports = function agentRoutes(pool, auth, bus) {
  const router = express.Router();

  // POST /api/triage  (JWT) — classify arbitrary text, optionally auto-file
  router.post('/triage', auth, async (req, res) => {
    const t = await triage(req.body.text);
    if (!t) return res.status(502).json({ error: 'triage_failed' });
    let filed = null;
    if (req.body.autofile && (t.category === 'lead' || t.category === 'enquiry')) {
      filed = await fileLead(pool, req.user.ws, t, req.body.source || 'triage');
      bus.emit(req.user.ws, { type: 'change', collection: 'leads', op: 'create', id: filed.doc_id });
    }
    res.json({ triage: t, filed });
  });

  // ── Inbound webhooks ──────────────────────────────────────
  // These are PUBLIC but gated by a shared secret in the path so randoms can't post.
  // Configure WEBHOOK_SECRET in env and use /api/webhooks/<secret>/whatsapp etc.
  function secretGate(req, res, next) {
    const expected = process.env.WEBHOOK_SECRET || '';
    // Accept the secret either in the path (Meta config compat) or an
    // X-Webhook-Secret header. Compare in constant time to avoid leaking it
    // via timing, and guard against length-mismatch throwing in timingSafeEqual.
    const provided = req.get('x-webhook-secret') || req.params.secret || '';
    if (!expected) return res.status(403).json({ error: 'forbidden' });
    const a = Buffer.from(String(provided));
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(403).json({ error: 'forbidden' });
    next();
  }

  // Meta WhatsApp verification handshake (GET) + message receipt (POST)
  router.get('/webhooks/:secret/whatsapp', secretGate, (req, res) => {
    if (req.query['hub.verify_token'] === (process.env.WA_VERIFY_TOKEN || process.env.WEBHOOK_SECRET))
      return res.send(req.query['hub.challenge']);
    res.sendStatus(403);
  });
  router.post('/webhooks/:secret/whatsapp', secretGate, express.json(), async (req, res) => {
    res.sendStatus(200); // ack immediately; process async
    try {
      const ws = process.env.DEFAULT_WORKSPACE_ID;
      if (!ws) return;
      const msgs = req.body?.entry?.[0]?.changes?.[0]?.value?.messages || [];
      for (const m of msgs) {
        const text = m.text?.body || m.button?.text || '';
        const from = m.from || 'WhatsApp';
        const t = await triage(text);
        if (t) await fileLead(pool, ws, t, 'WhatsApp', from);
        bus.emit(ws, { type: 'portal_message', channel: 'whatsapp', client: from, body: text });
      }
    } catch (e) { console.error('[wa]', e.message); }
  });

  // Generic inbound email (point an email-forwarding/parse service here)
  router.post('/webhooks/:secret/email', secretGate, express.json(), async (req, res) => {
    res.sendStatus(200);
    try {
      const ws = process.env.DEFAULT_WORKSPACE_ID;
      if (!ws) return;
      const text = `${req.body.subject || ''}\n\n${req.body.text || req.body.body || ''}`;
      const t = await triage(text);
      if (t) await fileLead(pool, ws, t, 'Email', req.body.from);
      bus.emit(ws, { type: 'change', collection: 'leads', op: 'create' });
    } catch (e) { console.error('[email]', e.message); }
  });

  return router;
};

// Create a lead in documents_store from a triage result.
async function fileLead(pool, ws, t, source, contact) {
  const e = t.extract || {};
  const val = parseFloat(String(e.value || '').replace(/[^0-9.]/g, '')) || 0;
  const id = require('crypto').randomUUID();
  const data = {
    id, name: e.name || contact || 'New enquiry', inquiry: e.inquiry || t.summary,
    value: val, source, stage: 'new', updated: new Date().toISOString().slice(0, 10),
    _rev: Date.now(),
  };
  await pool.query(
    `INSERT INTO documents_store(workspace_id, collection, doc_id, data) VALUES($1,'leads',$2,$3)
     ON CONFLICT (workspace_id, collection, doc_id) DO UPDATE SET data=$3, updated_at=now()`,
    [ws, id, data]
  );
  return { doc_id: id, ...data };
}
