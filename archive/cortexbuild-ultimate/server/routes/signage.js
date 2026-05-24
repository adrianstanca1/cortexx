const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { logAudit } = require('./audit-helper');

const { broadcastDashboardUpdate } = require('../lib/ws-broadcast');
const router = express.Router();

router.use(authMiddleware);

function safeFloat(val, fallback = null) {
  if (val === undefined || val === null || val === '') return fallback;
  const n = parseFloat(val);
  return Number.isNaN(n) ? fallback : n;
}

function safeInt(val, fallback = null) {
  if (val === undefined || val === null || val === '') return fallback;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? fallback : n;
}

// ─── Ensure table exists ─────────────────────────────────────────────────────
(async function initTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS signage (
        id SERIAL PRIMARY KEY,
        project_id INTEGER,
        type TEXT,
        location TEXT,
        size TEXT,
        material TEXT,
        quantity INTEGER DEFAULT 1,
        status TEXT DEFAULT 'pending',
        installation_date DATE,
        notes TEXT,
        organization_id INTEGER,
        company_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // Schema drift fixes: add columns introduced by frontend
    await pool.query(`ALTER TABLE signage ADD COLUMN IF NOT EXISTS description TEXT`);
    await pool.query(`ALTER TABLE signage ADD COLUMN IF NOT EXISTS required_date DATE`);
    await pool.query(`ALTER TABLE signage ADD COLUMN IF NOT EXISTS installed_by TEXT`);
    await pool.query(`ALTER TABLE signage ADD COLUMN IF NOT EXISTS last_inspected DATE`);
    await pool.query(`ALTER TABLE signage ADD COLUMN IF NOT EXISTS next_inspection DATE`);
    await pool.query(`ALTER TABLE signage ADD COLUMN IF NOT EXISTS inspection_interval INTEGER DEFAULT 30`);
    console.log('[signage] Table ensured');
  } catch (err) {
    console.error('[signage] Failed to ensure table:', err.message);
  }
})();

// ─── GET /api/signage ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, p.name as project_name
       FROM signage s
       LEFT JOIN projects p ON s.project_id = p.id
       WHERE COALESCE(s.organization_id, s.company_id) = $1
       ORDER BY s.updated_at DESC`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[signage GET]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST /api/signage ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    project_id, type, location, size, material,
    quantity, status, installation_date, installed_date,
    notes, description, required_date, installed_by,
    last_inspected, next_inspection, inspection_interval
  } = req.body;

  const quantityVal = safeInt(quantity, 1);
  const intervalVal = safeInt(inspection_interval, 30);
  if (quantityVal !== null && quantityVal < 0) {
    return res.status(400).json({ message: 'Quantity cannot be negative' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO signage (
        project_id, type, location, size, material,
        quantity, status, installation_date, notes,
        description, required_date, installed_by,
        last_inspected, next_inspection, inspection_interval,
        organization_id, company_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        project_id || null,
        type || null,
        location || null,
        size || null,
        material || null,
        quantityVal,
        status || 'pending',
        installation_date || installed_date || null,
        notes || null,
        description || null,
        required_date || null,
        installed_by || null,
        last_inspected || null,
        next_inspection || null,
        intervalVal,
        req.user.organization_id,
        req.user.company_id
      ]
    );

    logAudit({
      auth: req.user,
      action: 'create',
      entityType: 'signage',
      entityId: rows[0].id,
      newData: rows[0]
    });

    broadcastDashboardUpdate('create', 'signage', rows[0]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[signage POST]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/signage/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, p.name as project_name
       FROM signage s
       LEFT JOIN projects p ON s.project_id = p.id
       WHERE s.id = $1 AND COALESCE(s.organization_id, s.company_id) = $2`,
      [req.params.id, req.user.company_id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Signage item not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('[signage GET :id]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── PUT /api/signage/:id ─────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const {
    project_id, type, location, size, material,
    quantity, status, installation_date, installed_date,
    notes, description, required_date, installed_by,
    last_inspected, next_inspection, inspection_interval
  } = req.body;

  const quantityVal = safeInt(quantity);
  const intervalVal = safeInt(inspection_interval);
  if (quantityVal !== null && quantityVal < 0) {
    return res.status(400).json({ message: 'Quantity cannot be negative' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE signage SET
        project_id = COALESCE($1, project_id),
        type = COALESCE($2, type),
        location = COALESCE($3, location),
        size = COALESCE($4, size),
        material = COALESCE($5, material),
        quantity = COALESCE($6, quantity),
        status = COALESCE($7, status),
        installation_date = COALESCE($8, installation_date),
        notes = COALESCE($9, notes),
        description = COALESCE($10, description),
        required_date = COALESCE($11, required_date),
        installed_by = COALESCE($12, installed_by),
        last_inspected = COALESCE($13, last_inspected),
        next_inspection = COALESCE($14, next_inspection),
        inspection_interval = COALESCE($15, inspection_interval),
        updated_at = NOW()
       WHERE id = $16 AND COALESCE(organization_id, company_id) = $17
       RETURNING *`,
      [
        project_id, type, location, size, material,
        quantityVal, status, installation_date || installed_date, notes,
        description, required_date, installed_by,
        last_inspected, next_inspection, intervalVal,
        req.params.id, req.user.company_id
      ]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Signage item not found' });
    }

    logAudit({
      auth: req.user,
      action: 'update',
      entityType: 'signage',
      entityId: req.params.id,
      newData: rows[0]
    });

    broadcastDashboardUpdate('update', 'signage', rows[0]);

    res.json(rows[0]);
  } catch (err) {
    console.error('[signage PUT]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── DELETE /api/signage/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM signage
       WHERE id = $1 AND COALESCE(organization_id, company_id) = $2`,
      [req.params.id, req.user.company_id]
    );
    if (!rowCount) {
      return res.status(404).json({ message: 'Signage item not found' });
    }

    logAudit({
      auth: req.user,
      action: 'delete',
      entityType: 'signage',
      entityId: req.params.id
    });

    broadcastDashboardUpdate('delete', 'signage', { id: req.params.id });

    res.json({ message: 'Signage item deleted' });
  } catch (err) {
    console.error('[signage DELETE]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
