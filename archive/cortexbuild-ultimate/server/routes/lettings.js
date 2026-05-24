const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { logAudit } = require('./audit-helper');

const router = express.Router();

router.use(authMiddleware);

function safeFloat(val, fallback = null) {
  if (val === undefined || val === null || val === '') return fallback;
  const n = parseFloat(val);
  return Number.isNaN(n) ? fallback : n;
}

function safeFloatZero(val) {
  return safeFloat(val, 0);
}

// ─── Ensure table exists ─────────────────────────────────────────────────────
(async function initTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lettings (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        location TEXT,
        type TEXT,
        status TEXT DEFAULT 'available',
        rent NUMERIC(12,2),
        deposit NUMERIC(12,2),
        tenant_name TEXT,
        tenant_email TEXT,
        start_date DATE,
        end_date DATE,
        notes TEXT,
        organization_id INTEGER,
        company_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('[lettings] Table ensured');
  } catch (err) {
    console.error('[lettings] Failed to ensure table:', err.message);
  }
})();

// ─── GET /api/lettings ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM lettings
       WHERE COALESCE(organization_id, company_id) = $1
       ORDER BY updated_at DESC`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[lettings GET]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST /api/lettings ────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    title, description, location, type, status,
    rent, deposit, tenant_name, tenant_email,
    start_date, end_date, notes
  } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'Title is required' });
  }

  const rentVal = safeFloat(rent);
  const depositVal = safeFloat(deposit);

  if ((rentVal !== null && rentVal < 0) || (depositVal !== null && depositVal < 0)) {
    return res.status(400).json({ message: 'Rent and deposit cannot be negative' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO lettings (
        title, description, location, type, status,
        rent, deposit, tenant_name, tenant_email,
        start_date, end_date, notes,
        organization_id, company_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        title,
        description || null,
        location || null,
        type || null,
        status || 'available',
        rentVal,
        depositVal,
        tenant_name || null,
        tenant_email || null,
        start_date || null,
        end_date || null,
        notes || null,
        req.user.organization_id,
        req.user.company_id
      ]
    );

    logAudit({
      auth: req.user,
      action: 'create',
      entityType: 'lettings',
      entityId: rows[0].id,
      newData: rows[0]
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[lettings POST]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/lettings/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM lettings
       WHERE id = $1 AND COALESCE(organization_id, company_id) = $2`,
      [req.params.id, req.user.company_id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Letting not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('[lettings GET :id]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── PUT /api/lettings/:id ────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const {
    title, description, location, type, status,
    rent, deposit, tenant_name, tenant_email,
    start_date, end_date, notes
  } = req.body;

  const rentVal = safeFloat(rent);
  const depositVal = safeFloat(deposit);

  if ((rentVal !== null && rentVal < 0) || (depositVal !== null && depositVal < 0)) {
    return res.status(400).json({ message: 'Rent and deposit cannot be negative' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE lettings SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        location = COALESCE($3, location),
        type = COALESCE($4, type),
        status = COALESCE($5, status),
        rent = COALESCE($6, rent),
        deposit = COALESCE($7, deposit),
        tenant_name = COALESCE($8, tenant_name),
        tenant_email = COALESCE($9, tenant_email),
        start_date = COALESCE($10, start_date),
        end_date = COALESCE($11, end_date),
        notes = COALESCE($12, notes),
        updated_at = NOW()
       WHERE id = $13 AND COALESCE(organization_id, company_id) = $14
       RETURNING *`,
      [
        title, description, location, type, status,
        rentVal, depositVal, tenant_name, tenant_email,
        start_date, end_date, notes,
        req.params.id, req.user.company_id
      ]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Letting not found' });
    }

    logAudit({
      auth: req.user,
      action: 'update',
      entityType: 'lettings',
      entityId: req.params.id,
      newData: rows[0]
    });

    res.json(rows[0]);
  } catch (err) {
    console.error('[lettings PUT]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── DELETE /api/lettings/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM lettings
       WHERE id = $1 AND COALESCE(organization_id, company_id) = $2`,
      [req.params.id, req.user.company_id]
    );
    if (!rowCount) {
      return res.status(404).json({ message: 'Letting not found' });
    }

    logAudit({
      auth: req.user,
      action: 'delete',
      entityType: 'lettings',
      entityId: req.params.id
    });

    res.json({ message: 'Letting deleted' });
  } catch (err) {
    console.error('[lettings DELETE]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/lettings/packages ─────────────────────────────────────────────────
router.get('/packages', async (req, res) => {
  try {
    // Package analysis: group lettings by type with aggregated rent / deposit stats
    const { rows } = await pool.query(
      `SELECT
        type,
        COUNT(*) as letting_count,
        COALESCE(SUM(rent), 0) as total_rent,
        COALESCE(AVG(rent), 0) as avg_rent,
        COALESCE(SUM(deposit), 0) as total_deposit,
        COUNT(CASE WHEN status = 'available' THEN 1 END) as available_count,
        COUNT(CASE WHEN status = 'occupied' THEN 1 END) as occupied_count
      FROM lettings
      WHERE COALESCE(organization_id, company_id) = $1
      GROUP BY type
      ORDER BY letting_count DESC`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[lettings/packages GET]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/lettings/tenders ─────────────────────────────────────────────────
router.get('/tenders', async (req, res) => {
  try {
    // Tender comparison data: letting-level view for tender-style comparison
    const { rows } = await pool.query(
      `SELECT
        id,
        title,
        type,
        location,
        status,
        rent,
        deposit,
        tenant_name,
        start_date,
        end_date,
        (COALESCE(rent, 0) + COALESCE(deposit, 0)) as total_cost,
        CASE
          WHEN end_date IS NOT NULL AND end_date < CURRENT_DATE THEN 'expired'
          WHEN status = 'available' THEN 'open'
          ELSE status
        END as tender_status
      FROM lettings
      WHERE COALESCE(organization_id, company_id) = $1
      ORDER BY updated_at DESC`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[lettings/tenders GET]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
