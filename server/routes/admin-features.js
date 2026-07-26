// Cortexx — Admin: Feature platform (VERA) + RBAC + packages
// Mounted at /api/admin/features and /api/admin/access.
// Cross-tenant; every handler gated by adminAuth.
//
// Surfaces:
//   GET  /features/catalog        feature catalog (with effective state per tenant)
//   GET  /features/packages       package catalog
//   GET  /features/tenant/:ws      effective feature set for a tenant (resolved)
//   PUT  /features/tenant/:ws      set tenant feature overrides (enable/disable keys)
//   PUT  /features/user/:uid       set per-user feature overrides
//   GET  /access/roles             role catalog
//   PUT  /access/roles/:key        create/update a custom role
//   DELETE /access/roles/:key      delete a custom role
//   GET  /access/tenant/:ws        roles assigned in a tenant
//   PUT  /access/user/:uid/role    assign a role to a user
//   PUT  /access/tenant/:ws/package  assign/remove a package on a tenant
//   GET  /access/tenant/:ws/packages
//
function psqlDate() { return "now() - interval '7 days'"; }

module.exports = function featuresRoutes(pool, auth, adminAuth, wrap, bus) {
  const router = require('express').Router();
  const crypto = require('crypto');

  const emit = (ws, payload) => { try { bus && bus.emit(ws, payload); } catch (_) {} };
  async function audit(actor, action, target) {
    try {
      const prev = await pool.query('SELECT hash FROM audit_log WHERE workspace_id IS NULL ORDER BY id DESC LIMIT 1');
      const prevHash = prev.rows[0]?.hash || '';
      const hash = crypto.createHash('sha256').update(prevHash + actor + action + target + Date.now()).digest('hex');
      await pool.query('INSERT INTO audit_log(workspace_id, actor, action, target, hash) VALUES($1,$2,$3,$4,$5)', [null, actor, action, target, hash]);
    } catch (e) {}
  }
  const int = (v, d = 0) => parseInt(v, 10) || d;

  // ───────────────────────── Feature catalog ─────────────────────────
  router.get('/features/catalog', adminAuth, wrap(async (req, res) => {
    const ws = req.query.workspace_id;
    let effective = {};
    if (ws) {
      const r = await pool.query('SELECT feature_key, enabled FROM workspace_features WHERE workspace_id=$1', [ws]);
      effective = Object.fromEntries(r.rows.map(x => [x.feature_key, x.enabled]));
      const ur = await pool.query('SELECT feature_key, enabled FROM user_features WHERE user_id IN (SELECT id FROM users WHERE workspace_id=$1)', [ws]);
      // user overrides take precedence in the map (informational)
      ur.rows.forEach(x => effective[x.feature_key] = x.enabled);
    }
    const rows = await pool.query('SELECT key, name, category, description, default_on, min_plan FROM feature_flags ORDER BY category, name');
    res.json({ features: rows.rows.map(f => ({ ...f, effective: ws ? effective[f.key] ?? f.default_on : f.default_on })) });
  }));

  router.get('/features/packages', adminAuth, wrap(async (req, res) => {
    const rows = await pool.query('SELECT key, name, monthly_price, features, description, is_system FROM packages ORDER BY monthly_price');
    res.json({ packages: rows.rows });
  }));

  router.get('/features/tenant/:ws', adminAuth, wrap(async (req, res) => {
    const { ws } = req.params;
    const w = await pool.query('SELECT plan FROM workspaces WHERE id=$1', [ws]);
    if (!w.rows[0]) return res.status(404).json({ error: 'not_found' });
    const plan = w.rows[0].plan;
    const [cat, ov, uov, pk] = await Promise.all([
      pool.query('SELECT key, name, category, default_on, min_plan FROM feature_flags'),
      pool.query('SELECT feature_key, enabled FROM workspace_features WHERE workspace_id=$1', [ws]),
      pool.query('SELECT feature_key, enabled FROM user_features WHERE user_id IN (SELECT id FROM users WHERE workspace_id=$1)', [ws]),
      pool.query('SELECT package_key FROM workspace_packages WHERE workspace_id=$1', [ws]),
    ]);
    const ovMap = Object.fromEntries(ov.rows.map(x => [x.feature_key, x.enabled]));
    const uovMap = Object.fromEntries(uov.rows.map(x => [x.feature_key, x.enabled]));
    const resolved = cat.rows.map(f => {
      const userOverride = uovMap[f.key];
      const tenantOverride = ovMap[f.key];
      let enabled = f.default_on;
      if (typeof tenantOverride === 'boolean') enabled = tenantOverride;
      if (typeof userOverride === 'boolean') enabled = userOverride; // user wins
      return { key: f.key, name: f.name, category: f.category, enabled, plan_ok: true,
               source: typeof userOverride === 'boolean' ? 'user' : (typeof tenantOverride === 'boolean' ? 'tenant' : 'default') };
    });
    res.json({ workspace: ws, plan, features: resolved, packages: pk.rows.map(x => x.package_key) });
  }));

  // Set tenant feature overrides: body = { overrides: { key: bool, ... } }
  router.put('/features/tenant/:ws', adminAuth, wrap(async (req, res) => {
    const { ws } = req.params;
    const overrides = req.body && req.body.overrides;
    if (!overrides || typeof overrides !== 'object') return res.status(400).json({ error: 'overrides_required' });
    const keys = Object.keys(overrides).slice(0, 100);
    const valid = await pool.query('SELECT key FROM feature_flags WHERE key = ANY($1)', [keys]);
    const validSet = new Set(valid.rows.map(r => r.key));
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const k of keys) {
        if (!validSet.has(k)) continue;
        const v = !!overrides[k];
        await client.query(
          `INSERT INTO workspace_features(workspace_id, feature_key, enabled) VALUES($1,$2,$3)
           ON CONFLICT (workspace_id, feature_key) DO UPDATE SET enabled=$3`,
          [ws, k, v]);
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
    emit(ws, { type: 'features', action: 'tenant_features_updated' });
    await audit(req.user.uid, 'features.tenant_update', ws);
    res.json({ ok: true });
  }));

  router.put('/features/user/:uid', adminAuth, wrap(async (req, res) => {
    const { uid } = req.params;
    const overrides = req.body && req.body.overrides;
    if (!overrides || typeof overrides !== 'object') return res.status(400).json({ error: 'overrides_required' });
    const u = await pool.query('SELECT workspace_id FROM users WHERE id=$1', [uid]);
    if (!u.rows[0]) return res.status(404).json({ error: 'not_found' });
    const ws = u.rows[0].workspace_id;
    const keys = Object.keys(overrides).slice(0, 100);
    const valid = await pool.query('SELECT key FROM feature_flags WHERE key = ANY($1)', [keys]);
    const validSet = new Set(valid.rows.map(r => r.key));
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const k of keys) {
        if (!validSet.has(k)) continue;
        const v = !!overrides[k];
        await client.query(
          `INSERT INTO user_features(user_id, feature_key, enabled) VALUES($1,$2,$3)
           ON CONFLICT (user_id, feature_key) DO UPDATE SET enabled=$3`,
          [uid, k, v]);
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
    emit(ws, { type: 'features', action: 'user_features_updated', userId: uid });
    await audit(req.user.uid, 'features.user_update', uid);
    res.json({ ok: true });
  }));

  // ───────────────────────── Access / RBAC ─────────────────────────
  router.get('/access/roles', adminAuth, wrap(async (req, res) => {
    const rows = await pool.query('SELECT key, name, permissions, description, is_system FROM roles ORDER BY name');
    res.json({ roles: rows.rows });
  }));

  router.put('/access/roles/:key', adminAuth, wrap(async (req, res) => {
    const key = req.params.key;
    const { name, permissions, description } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name_required' });
    if (typeof permissions !== 'object' || Array.isArray(permissions)) return res.status(400).json({ error: 'permissions_required' });
    await pool.query(
      `INSERT INTO roles(key, name, permissions, description, is_system) VALUES($1,$2,$3,$4,false)
       ON CONFLICT (key) DO UPDATE SET name=$2, permissions=$3, description=$4, is_system=false`,
      [key, name, JSON.stringify(permissions), description || null]);
    await audit(req.user.uid, 'access.role_upsert', key);
    res.json({ ok: true });
  }));

  router.delete('/access/roles/:key', adminAuth, wrap(async (req, res) => {
    const { key } = req.params;
    const r = await pool.query('SELECT is_system FROM roles WHERE key=$1', [key]);
    if (!r.rows[0]) return res.status(404).json({ error: 'not_found' });
    if (r.rows[0].is_system) return res.status(400).json({ error: 'system_role_protected' });
    await pool.query('DELETE FROM roles WHERE key=$1', [key]);
    await audit(req.user.uid, 'access.role_delete', key);
    res.json({ ok: true });
  }));

  router.get('/access/tenant/:ws', adminAuth, wrap(async (req, res) => {
    const { ws } = req.params;
    const [users, roles] = await Promise.all([
      pool.query('SELECT id, name, email, role, is_platform_admin, disabled FROM users WHERE workspace_id=$1 ORDER BY name', [ws]),
      pool.query('SELECT user_id, role_key FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE workspace_id=$1)', [ws]),
    ]);
    const map = Object.fromEntries(roles.rows.map(r => [r.user_id, r.role_key]));
    res.json({ users: users.rows.map(u => ({ ...u, role_key: map[u.id] || u.role })) });
  }));

  router.put('/access/user/:uid/role', adminAuth, wrap(async (req, res) => {
    const { uid } = req.params;
    const role_key = req.body && req.body.role_key;
    if (!role_key) return res.status(400).json({ error: 'role_key_required' });
    const r = await pool.query('SELECT key FROM roles WHERE key=$1', [role_key]);
    if (!r.rows[0]) return res.status(404).json({ error: 'role_not_found' });
    const u = await pool.query('SELECT workspace_id FROM users WHERE id=$1', [uid]);
    if (!u.rows[0]) return res.status(404).json({ error: 'user_not_found' });
    await pool.query(
      `INSERT INTO user_roles(user_id, role_key) VALUES($1,$2)
       ON CONFLICT (user_id, role_key) DO UPDATE SET role_key=$2`, [uid, role_key]);
    // Keep legacy `role` column in sync for downstream code that reads it.
    await pool.query('UPDATE users SET role=$2 WHERE id=$1', [uid, role_key]);
    emit(u.rows[0].workspace_id, { type: 'access', action: 'role_changed', userId: uid, role: role_key });
    await audit(req.user.uid, 'access.user_role', `${uid} -> ${role_key}`);
    res.json({ ok: true });
  }));

  router.get('/access/tenant/:ws/packages', adminAuth, wrap(async (req, res) => {
    const { ws } = req.params;
    const r = await pool.query('SELECT package_key FROM workspace_packages WHERE workspace_id=$1', [ws]);
    res.json({ packages: r.rows.map(x => x.package_key) });
  }));

  // assign/remove package; body.assign = true|false
  router.put('/access/tenant/:ws/package', adminAuth, wrap(async (req, res) => {
    const { ws } = req.params;
    const package_key = req.body && req.body.package_key;
    const assign = req.body && req.body.assign !== false;
    if (!package_key) return res.status(400).json({ error: 'package_key_required' });
    const r = await pool.query('SELECT key, features FROM packages WHERE key=$1', [package_key]);
    if (!r.rows[0]) return res.status(404).json({ error: 'package_not_found' });
    if (assign) {
      await pool.query(
        `INSERT INTO workspace_packages(workspace_id, package_key, assigned_by) VALUES($1,$2,$3)
         ON CONFLICT (workspace_id, package_key) DO NOTHING`, [ws, package_key, req.user.uid]);
      // Apply the package's feature bundle as tenant overrides (enabled).
      const feats = r.rows[0].features || [];
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const fk of feats) {
          await client.query(
            `INSERT INTO workspace_features(workspace_id, feature_key, enabled) VALUES($1,$2,true)
             ON CONFLICT (workspace_id, feature_key) DO UPDATE SET enabled=true`, [ws, fk]);
        }
        await client.query('COMMIT');
      } catch (e) { await client.query('ROLLBACK'); throw e; }
      finally { client.release(); }
      // also bump plan to match package tier (best-effort)
      await pool.query('UPDATE workspaces SET plan=$2 WHERE id=$1 AND ($2 IS NOT NULL)', [ws, package_key === 'starter' ? 'free' : (package_key === 'professional' ? 'pro' : 'enterprise')]);
    } else {
      await pool.query('DELETE FROM workspace_packages WHERE workspace_id=$1 AND package_key=$2', [ws, package_key]);
    }
    emit(ws, { type: 'access', action: 'package_changed', package: package_key, assign });
    await audit(req.user.uid, assign ? 'access.package_assign' : 'access.package_remove', `${ws} <- ${package_key}`);
    res.json({ ok: true });
  }));

  return router;
};
