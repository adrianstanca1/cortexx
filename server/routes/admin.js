// Cortexx — SaaS platform admin console API
// Mounted at /api/admin by server/index.js.
//
// Fully cross-tenant. Every handler is gated by `adminAuth` (the platform-admin
// flag resolver) before it runs. The routes are organised into the same
// sections a real SaaS control panel needs:
//
//   GET  /overview          platform KPIs + recent activity
//   GET  /tenants           tenant (workspace) directory (filterable)
//   GET  /tenants/:id       single tenant + stats
//   PATCH/PUT /tenants/:id  update plan / name / suspended
//   DELETE /tenants/:id     hard-delete a tenant (cascade)
//   GET  /users             user directory (filterable)
//   POST /users/:id/grant-admin    promote/demote platform admin
//   POST /users/:id/disable        disable/enable an account
//   PATCH /users/:id        change role / name
//   GET  /billing          revenue + plan distribution + recent invoices
//   GET  /support/tickets  ticket directory
//   GET/PUT /support/tickets/:id
//   GET  /activity         cross-tenant activity feed
//   GET  /audit            platform audit trail (operator actions)
//   POST /operator/grant-admin   grant platform-admin by email
//   POST /operator/broadcast      push a system notice to all workspaces
//
// Security notes:
//  - We never expose password hashes. `disabled`/`is_platform_admin` are admin-
//    only fields and are never returned to non-admin callers (they aren't, since
//    this whole router is admin-only).
//  - Operator actions write to audit_log (platform scope, workspace_id NULL) so
//    every privileged action is attributable and tamper-evident (hash chain).
//  - Plan/suspend changes are intentionally powerful: they affect live tenants.
//    They are logged.

function psqlDate(range) {
  // map a named range to an interval clause (safe — no user input in SQL string)
  switch (range) {
    case '24h': return "now() - interval '24 hours'";
    case '7d': return "now() - interval '7 days'";
    case '30d': return "now() - interval '30 days'";
    case '90d': return "now() - interval '90 days'";
    default: return "now() - interval '7 days'";
  }
}

module.exports = function adminRoutes(pool, auth, adminAuth, wrap, bus) {
  const router = require('express').Router();
  const crypto = require('crypto');

  // Helper: ring the realtime bus for a tenant (used by suspend/delete/broadcast).
  const emit = (ws, payload) => { try { bus && bus.emit(ws, payload); } catch (_) {} };

  // Helper: append a platform-scope audit entry (hash-chained, tamper-evident).
  async function audit(actor, action, target) {
    try {
      const prev = await pool.query(
        'SELECT hash FROM audit_log WHERE workspace_id IS NULL ORDER BY id DESC LIMIT 1');
      const prevHash = prev.rows[0]?.hash || '';
      const hash = crypto.createHash('sha256')
        .update(prevHash + actor + action + target + Date.now()).digest('hex');
      await pool.query(
        'INSERT INTO audit_log(workspace_id, actor, action, target, hash) VALUES($1,$2,$3,$4,$5)',
        [null, actor, action, target, hash]);
    } catch (e) { /* audit is best-effort; never block the action */ }
  }

  const int = (v, d = 0) => parseInt(v, 10) || d;

  // ───────────────────────── Dashboard / overview ─────────────────────────
  router.get('/overview', adminAuth, wrap(async (req, res) => {
    const range = psqlDate(req.query.range);
    const [
      ws, us, pr, proj7, ticks, openProj, invoiced, paid, mrr,
      newWs, act, logins,
    ] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS n FROM workspaces'),
      pool.query('SELECT COUNT(*)::int AS n FROM users'),
      pool.query('SELECT COUNT(*)::int AS n FROM projects'),
      pool.query(`SELECT COUNT(*)::int AS n FROM projects WHERE created_at > ${range}`),
      pool.query("SELECT COUNT(*)::int AS n FROM support_tickets WHERE status IN ('open','in_progress')"),
      pool.query("SELECT COUNT(*)::int AS n FROM projects WHERE status NOT IN ('complete','cancelled')"),
      pool.query('SELECT COALESCE(SUM(amount),0)::float AS n FROM invoices'),
      pool.query("SELECT COALESCE(SUM(amount),0)::float AS n FROM invoices WHERE status='paid'"),
      pool.query("SELECT COUNT(*)::int AS n FROM workspaces WHERE plan='pro' AND suspended IS DISTINCT FROM true"),
      pool.query(`SELECT COUNT(*)::int AS n FROM workspaces WHERE created_at > ${range}`),
      pool.query(`SELECT COUNT(*)::int AS n FROM activity_log WHERE at > ${range}`),
      pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE created_at > ${range}`),
    ]);

    const planRows = await pool.query(
      `SELECT plan, COUNT(*)::int AS n FROM workspaces GROUP BY plan ORDER BY n DESC`);
    const tickRows = await pool.query(
      `SELECT priority, COUNT(*)::int AS n FROM support_tickets
       WHERE status IN ('open','in_progress') GROUP BY priority`);

    res.json({
      kpis: {
        workspaces: ws.rows[0].n,
        users: us.rows[0].n,
        projects: pr.rows[0].n,
        projects_active: openProj.rows[0].n,
        projects_new_range: proj7.rows[0].n,
        open_tickets: ticks.rows[0].n,
        total_invoiced: Math.round(invoiced.rows[0].n * 100) / 100,
        total_paid: Math.round(paid.rows[0].n * 100) / 100,
        active_pro_tenants: mrr.rows[0].n,
        new_workspaces_range: newWs.rows[0].n,
        activity_range: act.rows[0].n,
        new_users_range: logins.rows[0].n,
      },
      plan_distribution: planRows.rows,
      ticket_priority: tickRows.rows,
    });
  }));

  // ───────────────────────── Tenant (workspace) directory ─────────────────
  router.get('/tenants', adminAuth, wrap(async (req, res) => {
    const { q = '', plan = '', status = '' } = req.query;
    const params = [];
    let where = [];
    if (q) { params.push(`%${q.toLowerCase()}%`); where.push(`(lower(w.name) LIKE $${params.length} OR lower(w.company) LIKE $${params.length} OR lower(w.id::text) LIKE $${params.length})`); }
    if (plan) { params.push(plan); where.push(`w.plan = $${params.length}`); }
    if (status === 'suspended') where.push('w.suspended = true');
    if (status === 'active') where.push('(w.suspended IS DISTINCT FROM true)');
    const wsql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const r = await pool.query(`
      SELECT w.id, w.name, w.company, w.plan, w.suspended, w.created_at,
             (SELECT COUNT(*) FROM users u WHERE u.workspace_id = w.id) AS users,
             (SELECT COUNT(*) FROM projects p WHERE p.workspace_id = w.id) AS projects
      FROM workspaces w ${wsql}
      ORDER BY w.created_at DESC LIMIT 500`, params);
    res.json({ tenants: r.rows, count: r.rows.length });
  }));

  router.get('/tenants/:id', adminAuth, wrap(async (req, res) => {
    const { id } = req.params;
    const w = await pool.query('SELECT id, name, company, plan, suspended, created_at FROM workspaces WHERE id=$1', [id]);
    if (!w.rows[0]) return res.status(404).json({ error: 'not_found' });
    const [users, projects, recent] = await Promise.all([
      pool.query('SELECT id, name, email, role, is_platform_admin, disabled, created_at FROM users WHERE workspace_id=$1 ORDER BY created_at DESC', [id]),
      pool.query('SELECT id, name, status, value, pct, client FROM projects WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 50', [id]),
      pool.query('SELECT id, kind, title, sub, at, project_id FROM activity_log WHERE workspace_id=$1 ORDER BY at DESC LIMIT 25', [id]),
    ]);
    const inv = await pool.query("SELECT COALESCE(SUM(amount),0)::float AS n FROM invoices WHERE workspace_id=$1", [id]);
    res.json({
      tenant: w.rows[0],
      users: users.rows,
      projects: projects.rows,
      activity: recent.rows,
      invoiced: Math.round(inv.rows[0].n * 100) / 100,
    });
  }));

  router.put('/tenants/:id', adminAuth, wrap(async (req, res) => {
    const { id } = req.params;
    const { plan, name, company, suspended } = req.body;
    const sets = [];
    const params = [];
    if (typeof plan === 'string') { params.push(plan); sets.push(`plan=$${params.length}`); }
    if (typeof name === 'string') { params.push(name); sets.push(`name=$${params.length}`); }
    if (typeof company === 'string') { params.push(company); sets.push(`company=$${params.length}`); }
    if (typeof suspended === 'boolean') { params.push(suspended); sets.push(`suspended=$${params.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'no_fields' });
    params.push(id);
    const r = await pool.query(
      `UPDATE workspaces SET ${sets.join(', ')} WHERE id=$${params.length} RETURNING id, name, plan, suspended`,
      params);
    if (!r.rows[0]) return res.status(404).json({ error: 'not_found' });
    if (typeof suspended === 'boolean') {
      emit(id, { type: 'admin', action: suspended ? 'tenant_suspended' : 'tenant_reactivated' });
      audit(req.user.uid, suspended ? 'tenant.suspend' : 'tenant.reactivate', id);
    }
    await audit(req.user.uid, 'tenant.update', id);
    res.json({ tenant: r.rows[0] });
  }));

  router.delete('/tenants/:id', adminAuth, wrap(async (req, res) => {
    const { id } = req.params;
    const w = await pool.query('SELECT name FROM workspaces WHERE id=$1', [id]);
    if (!w.rows[0]) return res.status(404).json({ error: 'not_found' });
    // Cascade: ON DELETE CASCADE handles users/projects/etc. (FKs in schema.sql).
    await pool.query('DELETE FROM workspaces WHERE id=$1', [id]);
    emit(id, { type: 'admin', action: 'tenant_deleted' });
    await audit(req.user.uid, 'tenant.delete', `${id} (${w.rows[0].name})`);
    res.json({ ok: true });
  }));

  // ───────────────────────── User directory ───────────────────────────────
  router.get('/users', adminAuth, wrap(async (req, res) => {
    const { q = '', role = '', admin = '' } = req.query;
    const params = [];
    let where = [];
    if (q) { params.push(`%${q.toLowerCase()}%`); where.push(`(lower(u.name) LIKE $${params.length} OR lower(u.email) LIKE $${params.length})`); }
    if (role) { params.push(role); where.push(`u.role = $${params.length}`); }
    if (admin === '1') where.push('u.is_platform_admin = true');
    if (admin === '0') where.push('(u.is_platform_admin IS DISTINCT FROM true)');
    const wsql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const r = await pool.query(`
      SELECT u.id, u.name, u.email, u.role, u.created_at, u.is_platform_admin,
             u.disabled, u.last_active_at, w.name AS workspace
      FROM users u LEFT JOIN workspaces w ON w.id = u.workspace_id
      ${wsql} ORDER BY u.created_at DESC LIMIT 500`, params);
    res.json({ users: r.rows, count: r.rows.length });
  }));

  router.patch('/users/:id', adminAuth, wrap(async (req, res) => {
    const { id } = req.params;
    const { role, name, disabled } = req.body;
    const sets = [];
    const params = [];
    if (typeof role === 'string') { params.push(role); sets.push(`role=$${params.length}`); }
    if (typeof name === 'string') { params.push(name); sets.push(`name=$${params.length}`); }
    if (typeof disabled === 'boolean') { params.push(disabled); sets.push(`disabled=$${params.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'no_fields' });
    params.push(id);
    const r = await pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id=$${params.length} RETURNING id, name, email, role, is_platform_admin, disabled`,
      params);
    if (!r.rows[0]) return res.status(404).json({ error: 'not_found' });
    if (typeof disabled === 'boolean') {
      await pool.query(
        'UPDATE users SET last_active_at = NULL WHERE id=$1', [id]);
    }
    await audit(req.user.uid, 'user.update', id);
    res.json({ user: r.rows[0] });
  }));

  router.post('/users/:id/grant-admin', adminAuth, wrap(async (req, res) => {
    const { id } = req.params;
    const flag = req.body.grant === false ? false : true;
    const r = await pool.query(
      'UPDATE users SET is_platform_admin=$2 WHERE id=$1 RETURNING id, email, is_platform_admin',
      [id, flag]);
    if (!r.rows[0]) return res.status(404).json({ error: 'not_found' });
    await audit(req.user.uid, flag ? 'user.grant_admin' : 'user.revoke_admin', id);
    res.json({ user: r.rows[0] });
  }));

  router.post('/users/:id/disable', adminAuth, wrap(async (req, res) => {
    const { id } = req.params;
    const disabled = req.body.disabled === false ? false : true;
    const r = await pool.query(
      'UPDATE users SET disabled=$2, last_active_at = NULL WHERE id=$1 RETURNING id, email, disabled',
      [id, disabled]);
    if (!r.rows[0]) return res.status(404).json({ error: 'not_found' });
    if (disabled) emit(r.rows[0].workspace_id, { type: 'admin', action: 'user_disabled', userId: id });
    await audit(req.user.uid, disabled ? 'user.disable' : 'user.enable', id);
    res.json({ user: r.rows[0] });
  }));

  // ───────────────────────── Billing / financials ─────────────────────────
  router.get('/billing', adminAuth, wrap(async (req, res) => {
    const planRows = await pool.query(
      `SELECT plan, COUNT(*)::int AS tenants,
              COUNT(*) FILTER (WHERE suspended IS DISTINCT FROM true)::int AS active
       FROM workspaces GROUP BY plan ORDER BY tenants DESC`);
    const invByStatus = await pool.query(
      `SELECT status, COUNT(*)::int AS n, COALESCE(SUM(amount),0)::float AS total
       FROM invoices GROUP BY status ORDER BY n DESC`);
    const top = await pool.query(`
      SELECT w.id, w.name, w.plan, w.suspended,
             COALESCE(SUM(i.amount),0)::float AS invoiced,
             COUNT(i.id)::int AS invoices
      FROM workspaces w LEFT JOIN invoices i ON i.workspace_id = w.id
      GROUP BY w.id, w.name, w.plan, w.suspended
      ORDER BY invoiced DESC LIMIT 25`);
    const invoiced = await pool.query('SELECT COALESCE(SUM(amount),0)::float AS n FROM invoices');
    const paid = await pool.query("SELECT COALESCE(SUM(amount),0)::float AS n FROM invoices WHERE status='paid'");
    // Pro tenants = recurring revenue proxy (no real payments table; flag-based).
    const pro = await pool.query("SELECT COUNT(*)::int AS n FROM workspaces WHERE plan='pro' AND suspended IS DISTINCT FROM true");
    res.json({
      plan_distribution: planRows.rows,
      invoices_by_status: invByStatus.rows,
      total_invoiced: Math.round(invoiced.rows[0].n * 100) / 100,
      total_paid: Math.round(paid.rows[0].n * 100) / 100,
      recurring_tenants: pro.rows[0].n,
      top_tenants: top.rows,
    });
  }));

  router.get('/billing/invoices', adminAuth, wrap(async (req, res) => {
    const { status = '' } = req.query;
    const params = [];
    let wsql = '';
    if (status) { params.push(status); wsql = 'WHERE i.status=$1'; }
    const r = await pool.query(`
      SELECT i.id, i.client, i.amount, i.status, i.issued, i.due, i.paid,
             w.name AS tenant, w.id AS workspace_id
      FROM invoices i LEFT JOIN workspaces w ON w.id = i.workspace_id
      ${wsql} ORDER BY i.issued DESC NULLS LAST LIMIT 500`, params);
    res.json({ invoices: r.rows });
  }));

  // ───────────────────────── Support tickets ──────────────────────────────
  router.get('/support/tickets', adminAuth, wrap(async (req, res) => {
    const { status = '' } = req.query;
    const params = [];
    let wsql = '';
    if (status) { params.push(status); wsql = 'WHERE status=$1'; }
    const r = await pool.query(`
      SELECT id, name, email, subject, priority, status, created_at, updated_at, workspace_id
      FROM support_tickets ${wsql} ORDER BY created_at DESC LIMIT 500`, params);
    res.json({ tickets: r.rows });
  }));

  router.get('/support/tickets/:id', adminAuth, wrap(async (req, res) => {
    const r = await pool.query('SELECT * FROM support_tickets WHERE id=$1', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ ticket: r.rows[0] });
  }));

  router.put('/support/tickets/:id', adminAuth, wrap(async (req, res) => {
    const { status, priority, reply } = req.body;
    const sets = [];
    const params = [];
    if (['open', 'in_progress', 'resolved', 'closed'].includes(status)) { params.push(status); sets.push(`status=$${params.length}`); }
    if (['low', 'normal', 'high', 'urgent'].includes(priority)) { params.push(priority); sets.push(`priority=$${params.length}`); }
    if (typeof reply === 'string' && reply.trim()) { params.push(reply); sets.push(`reply=$${params.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'no_fields' });
    params.push(req.params.id);
    const r = await pool.query(
      `UPDATE support_tickets SET ${sets.join(', ')}, updated_at=now() WHERE id=$${params.length} RETURNING *`,
      params);
    if (!r.rows[0]) return res.status(404).json({ error: 'not_found' });
    await audit(req.user.uid, 'ticket.update', req.params.id);
    res.json({ ticket: r.rows[0] });
  }));

  // ───────────────────────── Cross-tenant activity & audit ────────────────
  router.get('/activity', adminAuth, wrap(async (req, res) => {
    const limit = Math.min(int(req.query.limit, 50), 200);
    const r = await pool.query(
      `SELECT id, workspace_id, actor, kind, title, sub, project_id, at
       FROM activity_log ORDER BY at DESC LIMIT $1`, [limit]);
    // Light join for workspace names (cheap; ≤200 rows).
    const wsIds = [...new Set(r.rows.map(x => x.workspace_id).filter(Boolean))];
    let names = {};
    if (wsIds.length) {
      const w = await pool.query('SELECT id, name FROM workspaces WHERE id = ANY($1)', [wsIds]);
      names = Object.fromEntries(w.rows.map(x => [x.id, x.name]));
    }
    res.json({ activity: r.rows.map(x => ({ ...x, workspace_name: names[x.workspace_id] || null })) });
  }));

  router.get('/audit', adminAuth, wrap(async (req, res) => {
    const limit = Math.min(int(req.query.limit, 100), 500);
    const r = await pool.query(
      `SELECT id, actor, action, target, created_at
       FROM audit_log WHERE workspace_id IS NULL ORDER BY id DESC LIMIT $1`, [limit]);
    res.json({ audit: r.rows });
  }));

  // ───────────────────────── Operator actions ─────────────────────────────
  // Grant/revoke platform-admin by email (source of truth = allowlist, but this
  // lets an operator act on an existing account immediately).
  router.post('/operator/grant-admin', adminAuth, wrap(async (req, res) => {
    const { email, grant } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'email_required' });
    const flag = grant === false ? false : true;
    const r = await pool.query(
      'UPDATE users SET is_platform_admin=$2 WHERE lower(email)=lower($1) RETURNING id, email, is_platform_admin',
      [email, flag]);
    if (!r.rows[0]) return res.status(404).json({ error: 'user_not_found' });
    await audit(req.user.uid, flag ? 'operator.grant_admin' : 'operator.revoke_admin', email);
    res.json({ user: r.rows[0] });
  }));

  // Broadcast a system notice to every workspace via the realtime bus + a
  // notification row per workspace (best-effort; never blocks).
  router.post('/operator/broadcast', adminAuth, wrap(async (req, res) => {
    const { title, body, kind = 'system' } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'title_and_body_required' });
    const wss = await pool.query('SELECT id FROM workspaces WHERE suspended IS DISTINCT FROM true');
    let delivered = 0;
    for (const { id } of wss.rows) {
      try {
        await pool.query(
          `INSERT INTO notifications(id, workspace_id, title, body, kind, data)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [crypto.randomUUID(), id, title, body, kind, JSON.stringify({ broadcast: true })]);
        emit(id, { type: 'notification', title, body, kind });
        delivered++;
      } catch (_) {}
    }
    await audit(req.user.uid, 'operator.broadcast', `${delivered} workspaces`);
    res.json({ ok: true, delivered });
  }));

  return router;
};
