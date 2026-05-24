const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

function buildTenantFilter(req) {
  if (req.user.role === 'super_admin') return { clause: '', params: [] };
  if (req.user.organization_id) {
    return { clause: ' AND organization_id = $1', params: [req.user.organization_id] };
  }
  if (req.user.company_id) {
    return { clause: ' AND company_id = $1', params: [req.user.company_id] };
  }
  return { clause: ' AND 1=0', params: [] };
}

// GET /api/permits/stats — overview counts
router.get('/permits/stats', async (req, res) => {
  try {
    const { clause, params } = buildTenantFilter(req);
    const { rows: statusRows } = await pool.query(
      `SELECT status, COUNT(*)::int as count FROM site_permits WHERE 1=1${clause} GROUP BY status`,
      params
    );
    const { rows: expiringRows } = await pool.query(
      `SELECT COUNT(*)::int as count FROM site_permits WHERE to_date < NOW() + INTERVAL '30 days' AND status NOT IN ('expired','revoked')${clause}`,
      params
    );
    const { rows: overdueRows } = await pool.query(
      `SELECT COUNT(*)::int as count FROM site_permits WHERE to_date < NOW() AND status NOT IN ('expired','revoked')${clause}`,
      params
    );
    res.json({
      byStatus: statusRows.reduce((acc, r) => { acc[r.status || 'unknown'] = r.count; return acc; }, {}),
      expiringSoon: expiringRows[0]?.count || 0,
      overdue: overdueRows[0]?.count || 0,
    });
  } catch (err) {
    console.error('[Permits Stats]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/permits/expiring — permits expiring in next N days (default 30)
router.get('/permits/expiring', async (req, res) => {
  try {
    const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));
    const { clause, params } = buildTenantFilter(req);
    const { rows } = await pool.query(
      `SELECT * FROM site_permits WHERE to_date < NOW() + INTERVAL '${days} days' AND status NOT IN ('expired','revoked')${clause} ORDER BY to_date ASC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('[Permits Expiring]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/permits/renewals/:id — history of renewals for a permit
router.get('/permits/renewals/:id', async (req, res) => {
  try {
    const { clause, params } = buildTenantFilter(req);
    // verify ownership
    const { rows: permitRows } = await pool.query(
      `SELECT id FROM site_permits WHERE id = $1${clause}`,
      [req.params.id, ...(params.length ? params : [])]
    );
    if (!permitRows[0]) return res.status(404).json({ message: 'Permit not found' });

    const { rows } = await pool.query(
      `SELECT * FROM permit_renewals WHERE permit_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[Permits Renewals]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/permits/:id/renew — create a renewal record and update permit dates
router.post('/permits/:id/renew', async (req, res) => {
  try {
    const { new_end_date, notes } = req.body;
    if (!new_end_date) return res.status(400).json({ message: 'new_end_date is required' });
    const { clause, params } = buildTenantFilter(req);

    // Fetch current permit
    const permitQ = `SELECT * FROM site_permits WHERE id = $1${clause}`;
    const permitParams = [req.params.id, ...(params.length ? params : [])];
    const { rows: permitRows } = await pool.query(permitQ, permitParams);
    if (!permitRows[0]) return res.status(404).json({ message: 'Permit not found' });
    const permit = permitRows[0];

    const orgId = req.user.organization_id || null;
    const companyId = req.user.company_id || null;

    // Insert renewal record
    await pool.query(
      `INSERT INTO permit_renewals (permit_id, previous_end_date, new_end_date, previous_status, new_status, renewed_by, notes, organization_id, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        req.params.id,
        permit.to_date,
        new_end_date,
        permit.status,
        permit.status === 'expired' ? 'active' : permit.status,
        req.user.name || req.user.email || 'Unknown',
        notes || null,
        orgId,
        companyId,
      ]
    );

    // Update permit
    const { rows: updated } = await pool.query(
      `UPDATE site_permits SET to_date = $1, renewal_date = $2, status = COALESCE(NULLIF($3, ''), status), updated_at = NOW() WHERE id = $4${clause} RETURNING *`,
      [new_end_date, new_end_date, permit.status === 'expired' ? 'active' : permit.status, req.params.id, ...(params.length ? params : [])]
    );

    res.json(updated[0]);
  } catch (err) {
    console.error('[Permit Renew]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/permits/:id/remind — mark reminder as sent
router.post('/permits/:id/remind', async (req, res) => {
  try {
    const { clause, params } = buildTenantFilter(req);
    const { rows } = await pool.query(
      `UPDATE site_permits SET reminder_sent = true, updated_at = NOW() WHERE id = $1${clause} RETURNING *`,
      [req.params.id, ...(params.length ? params : [])]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Permit not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[Permit Remind]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
