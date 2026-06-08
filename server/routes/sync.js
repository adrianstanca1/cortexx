// Cortexx API — Sync + contractor-side portal inbox (JWT-scoped)
// Mounted at /api. Gives the cloud-sync client a pull endpoint and the
// app a way to read/reply to portal messages.

const express = require('express');

module.exports = function syncRoutes(pool, auth) {
  const router = express.Router();

  // GET /api/sync/pull?since=ISO — everything changed since `since`
  // Authoritative store is documents_store; typed tables provide a seed
  // baseline that documents_store rows override by id. Also reads the v1.3
  // typed-JSONB tables so those collections sync back too.
  const V13 = {
    receipts: 'receipts', cisSubs: 'cis_subs', cisPayments: 'cis_payments',
    timesheets: 'timesheets', diary: 'diary_entries', snags: 'snags',
    changeOrders: 'change_orders', rfis: 'rfis', subs: 'subs',
    materials: 'materials', documentsMeta: 'documents_meta',
    equipment: 'equipment', notifications: 'notifications', siteMaps: 'site_maps',
  };
  router.get('/sync/pull', auth, async (req, res) => {
    const since = req.query.since ? new Date(req.query.since) : new Date(0);
    const ws = req.user.ws;
    const out = {};
    // 1. Core typed tables → seed baseline
    for (const t of ['projects', 'tasks', 'team_members', 'invoices', 'quotes']) {
      try { const r = await pool.query(`SELECT * FROM ${t} WHERE workspace_id=$1`, [ws]); out[t] = r.rows; }
      catch (e) { out[t] = []; }
    }
    // 2. v1.3 typed-JSONB tables → merge typed columns under `data`
    for (const [coll, tbl] of Object.entries(V13)) {
      try {
        const r = await pool.query(`SELECT * FROM ${tbl} WHERE workspace_id=$1`, [ws]);
        out[coll] = r.rows.map(row => { const { data, workspace_id, ...cols } = row; return { ...cols, ...(data || {}) }; });
      } catch (e) { /* table may not exist yet */ }
    }
    // 3. documents_store is authoritative — overlay over typed by id
    const docs = await pool.query(
      'SELECT collection, doc_id, data FROM documents_store WHERE workspace_id=$1',
      [ws]
    );
    for (const row of docs.rows) {
      const arr = (out[row.collection] ||= []);
      const rec = { id: row.doc_id, ...row.data };
      const idx = arr.findIndex(x => String(x.id) === String(row.doc_id));
      if (idx >= 0) arr[idx] = rec; else arr.push(rec);
    }
    res.json({ at: new Date().toISOString(), collections: out });
  });

  // POST /api/sync/bulk — replay an offline queue [{collection,op,id,data}]
  router.post('/sync/bulk', auth, async (req, res) => {
    const ops = Array.isArray(req.body.ops) ? req.body.ops.slice(0, 1000) : [];
    const ws = req.user.ws;
    let applied = 0;
    for (const o of ops) {
      try {
        if (o.op === 'delete') {
          await pool.query('DELETE FROM documents_store WHERE workspace_id=$1 AND collection=$2 AND doc_id=$3', [ws, o.collection, o.id]);
        } else {
          await pool.query(
            `INSERT INTO documents_store(workspace_id, collection, doc_id, data) VALUES($1,$2,$3,$4)
             ON CONFLICT (workspace_id, collection, doc_id) DO UPDATE SET data=$4, updated_at=now()`,
            [ws, o.collection, o.id, o.data || {}]
          );
        }
        await pool.query('INSERT INTO sync_log(workspace_id, collection, doc_id, op) VALUES($1,$2,$3,$4)', [ws, o.collection, o.id, o.op]);
        applied++;
      } catch (e) { /* skip bad op */ }
    }
    res.json({ ok: true, applied });
  });

  // ── Contractor-side portal inbox ──────────────────────────
  router.get('/portal-inbox', auth, async (req, res) => {
    const r = await pool.query(
      'SELECT * FROM portal_messages WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 200',
      [req.user.ws]
    );
    res.json(r.rows);
  });

  router.post('/portal-inbox/:id/read', auth, async (req, res) => {
    await pool.query('UPDATE portal_messages SET read=true WHERE id=$1 AND workspace_id=$2', [req.params.id, req.user.ws]);
    res.json({ ok: true });
  });

  router.post('/portal-inbox/:id/reply', auth, async (req, res) => {
    const body = (req.body.body || '').toString().slice(0, 4000);
    const src = await pool.query('SELECT project_id, client FROM portal_messages WHERE id=$1 AND workspace_id=$2', [req.params.id, req.user.ws]);
    if (!src.rows[0]) return res.status(404).json({ error: 'not_found' });
    await pool.query('UPDATE portal_messages SET read=true, replied=true WHERE id=$1', [req.params.id]);
    await pool.query(
      `INSERT INTO portal_messages(workspace_id, project_id, client, body, kind, direction)
       VALUES($1,$2,$3,$4,'message','out')`,
      [req.user.ws, src.rows[0].project_id, src.rows[0].client, body]
    );
    res.json({ ok: true });
  });

  // Issue / list share tokens for a project
  router.post('/projects/:id/share', auth, async (req, res) => {
    const token = require('crypto').randomBytes(9).toString('base64url');
    await pool.query(
      'INSERT INTO portal_tokens(token, workspace_id, project_id) VALUES($1,$2,$3)',
      [token, req.user.ws, req.params.id]
    );
    res.json({ token, url: `/p/${token}` });
  });

  return router;
};
