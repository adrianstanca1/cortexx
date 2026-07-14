// Cortexx API — Client portal routes (PUBLIC, token-scoped)
// Mounted at /api/portal. These routes DON'T require a JWT — a share token
// grants read-only access to exactly one project, mirroring portal.html.

const express = require('express');

module.exports = function portalRoutes(pool, bus) {
  const router = express.Router();

  // Resolve a share token → { workspace_id, project_id } or null
  async function resolve(token) {
    const r = await pool.query(
      'SELECT workspace_id, project_id FROM portal_tokens WHERE token=$1 AND revoked=false',
      [token]
    );
    return r.rows[0] || null;
  }

  // GET /api/portal/:token — read-only project snapshot for the client
  router.get('/:token', async (req, res) => {
    const ctx = await resolve(req.params.token);
    if (!ctx) return res.status(404).json({ error: 'invalid_or_revoked_token' });

    // Also scope by the token's workspace (defense-in-depth: a token can never
    // read another tenant's project even if a project_id were ever reused).
    const proj = await pool.query('SELECT id, name, client, value, pct, status, addr, due FROM projects WHERE id=$1 AND workspace_id=$2', [ctx.project_id, ctx.workspace_id]);
    if (!proj.rows[0]) return res.status(404).json({ error: 'project_not_found' });

    const invs = await pool.query(
      'SELECT id, amount, status, issued, due FROM invoices WHERE project_id=$1 AND workspace_id=$2 ORDER BY issued',
      [ctx.project_id, ctx.workspace_id]
    );
    // Recent activity lives in documents_store under 'activity'
    const acts = await pool.query(
      `SELECT data FROM documents_store WHERE workspace_id=$1 AND collection='activity'
       AND (data->>'projectId')=$2 ORDER BY updated_at DESC LIMIT 8`,
      [ctx.workspace_id, String(ctx.project_id)]
    );
    res.json({
      project: proj.rows[0],
      invoices: invs.rows,
      updates: acts.rows.map(r => r.data),
    });
  });

  // POST /api/portal/:token/message — client sends a note
  router.post('/:token/message', async (req, res) => {
    const ctx = await resolve(req.params.token);
    if (!ctx) return res.status(404).json({ error: 'invalid_or_revoked_token' });
    const body = (req.body.body || '').toString().slice(0, 4000);
    if (!body.trim()) return res.status(400).json({ error: 'empty' });
    const client = (req.body.client || 'Client').toString().slice(0, 200);
    const r = await pool.query(
      `INSERT INTO portal_messages(workspace_id, project_id, client, body, kind, direction)
       VALUES($1,$2,$3,$4,'message','in') RETURNING id, created_at`,
      [ctx.workspace_id, ctx.project_id, client, body]
    );
    bus.emit(ctx.workspace_id, { type: 'portal_message', projectId: ctx.project_id, client, body });
    res.json({ ok: true, id: r.rows[0].id });
  });

  // POST /api/portal/:token/approve — client approves the quote
  router.post('/:token/approve', async (req, res) => {
    const ctx = await resolve(req.params.token);
    if (!ctx) return res.status(404).json({ error: 'invalid_or_revoked_token' });
    const client = (req.body.client || 'Client').toString().slice(0, 200);
    const proj = await pool.query('SELECT name FROM projects WHERE id=$1 AND workspace_id=$2', [ctx.project_id, ctx.workspace_id]);
    const name = proj.rows[0]?.name || 'project';
    await pool.query(
      `INSERT INTO portal_messages(workspace_id, project_id, client, body, kind, direction)
       VALUES($1,$2,$3,$4,'approval','in')`,
      [ctx.workspace_id, ctx.project_id, client, `✓ Approved the quote for ${name}.`]
    );
    // Flip the project out of 'quoting'
    await pool.query(`UPDATE projects SET status='active' WHERE id=$1 AND workspace_id=$2 AND status='quoting'`, [ctx.project_id, ctx.workspace_id]);
    bus.emit(ctx.workspace_id, { type: 'portal_approval', projectId: ctx.project_id, client });
    res.json({ ok: true });
  });

  return router;
};
