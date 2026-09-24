// Cortexx API — Sync + contractor-side portal inbox (JWT-scoped)
// Mounted at /api. Gives the cloud-sync client a pull endpoint and the
// app a way to read/reply to portal messages.

const express = require('express');
const { NATIVE, tableFor } = require('../collections');
const { isRestrictedCollection } = require('../security');
const { validateOperation, applyOperations } = require('../collection-store');
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = function syncRoutes(pool, auth, bus = { emit() {} }) {
  const router = express.Router();

  // Full authoritative snapshot. Do not swallow database failures and return
  // an incomplete snapshot that clients could mistake for deleted records.
  router.get('/sync/pull', auth, wrap(async (req, res) => {
    const ws = req.user.ws;
    const out = Object.create(null);
    for (const collection of NATIVE) {
      if (collection === 'team_members') continue;
      const r = await pool.query(`SELECT * FROM ${tableFor(collection)} WHERE workspace_id=$1`, [ws]);
      out[collection] = r.rows.map(row => {
        const { data, workspace_id, ...cols } = row;
        return { ...cols, ...(data || {}), id: row.id };
      });
    }
    const docs = await pool.query(
      'SELECT collection, doc_id, data FROM documents_store WHERE workspace_id=$1', [ws]);
    for (const row of docs.rows) {
      if (isRestrictedCollection(row.collection) ||
          ['__proto__', 'constructor', 'prototype'].includes(row.collection)) continue;
      const collection = row.collection === 'team_members' ? 'team' : row.collection;
      const arr = (out[collection] ||= []);
      const rec = { ...row.data, id: row.doc_id };
      const idx = arr.findIndex(x => String(x.id) === String(row.doc_id));
      if (idx >= 0) arr[idx] = rec; else arr.push(rec);
    }
    res.json({ at: new Date().toISOString(), fullSnapshot: true, collections: out });
  }));

  // Validate the entire batch before touching the DB. Commit all operations
  // together, so a successful response always acknowledges the entire batch.
  router.post('/sync/bulk', auth, wrap(async (req, res) => {
    const ops = req.body && req.body.ops;
    if (!Array.isArray(ops) || ops.length > 1000) {
      return res.status(400).json({ error: 'invalid_batch', maxOperations: 1000 });
    }
    for (let i = 0; i < ops.length; i++) {
      const error = validateOperation(ops[i]);
      if (error) return res.status(error === 'collection_restricted' ? 403 : 400).json({ error, index: i });
    }
    if (ops.length) await applyOperations(pool, req.user.ws, ops);
    for (const o of ops) bus.emit(req.user.ws, { type: 'change', collection: o.collection, op: o.op, id: o.id });
    res.json({ ok: true, applied: ops.length });
  }));

  // ── Contractor-side portal inbox ──────────────────────────
  router.get('/portal-inbox', auth, wrap(async (req, res) => {
    const r = await pool.query(
      'SELECT * FROM portal_messages WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 200',
      [req.user.ws]
    );
    res.json(r.rows);
  }));

  router.post('/portal-inbox/:id/read', auth, wrap(async (req, res) => {
    await pool.query('UPDATE portal_messages SET read=true WHERE id=$1 AND workspace_id=$2', [req.params.id, req.user.ws]);
    res.json({ ok: true });
  }));

  router.post('/portal-inbox/:id/reply', auth, wrap(async (req, res) => {
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
  }));

  // Issue / list share tokens for a project
  router.post('/projects/:id/share', auth, wrap(async (req, res) => {
    const project = await pool.query(
      'SELECT id::text FROM projects WHERE id::text=$1 AND workspace_id=$2',
      [req.params.id, req.user.ws]);
    if (!project.rows.length) return res.status(404).json({ error: 'not_found' });
    const token = require('crypto').randomBytes(9).toString('base64url');
    await pool.query(
      'INSERT INTO portal_tokens(token, workspace_id, project_id) VALUES($1,$2,$3)',
      [token, req.user.ws, req.params.id]
    );
    res.json({ token, url: `/p/${token}` });
  }));

  return router;
};
