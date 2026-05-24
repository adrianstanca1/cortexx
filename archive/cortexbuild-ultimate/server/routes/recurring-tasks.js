const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { checkPermission } = require('../middleware/checkPermission');
const { buildTenantFilter } = require('../middleware/tenantFilter');

const router = express.Router();
router.use(authMiddleware);

const VALID_FREQUENCIES = ['daily','weekly','monthly','quarterly','yearly'];

router.get('/', checkPermission('tasks', 'read'), async (req, res) => {
  try {
    const { clause, params } = buildTenantFilter(req, 'WHERE');
    const query = `SELECT * FROM recurring_tasks${clause} ORDER BY next_run_date ASC`;
    const { rows } = await pool.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('[GET recurring-tasks]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', checkPermission('tasks', 'create'), async (req, res) => {
  try {
    const { project_id, title, description, frequency, interval_count, next_run_date, end_date, assigned_to, category, estimated_hours } = req.body;
    if (!title || !frequency) return res.status(400).json({ message: 'title and frequency are required' });
    if (!VALID_FREQUENCIES.includes(frequency)) return res.status(400).json({ message: `frequency must be one of ${VALID_FREQUENCIES.join(', ')}` });
    const orgId = req.user.organization_id || null;
    const compId = req.user.company_id || null;
    const { rows } = await pool.query(
      `INSERT INTO recurring_tasks (organization_id, company_id, project_id, title, description, frequency, interval_count, next_run_date, end_date, assigned_to, category, estimated_hours)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [orgId, compId, project_id || null, title, description || '', frequency, interval_count || 1, next_run_date, end_date || null, assigned_to || null, category || 'general', estimated_hours || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST recurring-tasks]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/:id', checkPermission('tasks', 'update'), async (req, res) => {
  try {
    const { title, description, frequency, interval_count, next_run_date, end_date, assigned_to, category, estimated_hours, active } = req.body;
    const fields = [];
    const vals = [];
    let idx = 1;
    if (title !== undefined) { fields.push(`title = $${idx++}`); vals.push(title); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); vals.push(description); }
    if (frequency !== undefined) { fields.push(`frequency = $${idx++}`); vals.push(frequency); }
    if (interval_count !== undefined) { fields.push(`interval_count = $${idx++}`); vals.push(interval_count); }
    if (next_run_date !== undefined) { fields.push(`next_run_date = $${idx++}`); vals.push(next_run_date); }
    if (end_date !== undefined) { fields.push(`end_date = $${idx++}`); vals.push(end_date); }
    if (assigned_to !== undefined) { fields.push(`assigned_to = $${idx++}`); vals.push(assigned_to); }
    if (category !== undefined) { fields.push(`category = $${idx++}`); vals.push(category); }
    if (estimated_hours !== undefined) { fields.push(`estimated_hours = $${idx++}`); vals.push(estimated_hours); }
    if (active !== undefined) { fields.push(`active = $${idx++}`); vals.push(active); }
    if (fields.length === 0) return res.status(400).json({ message: 'No fields to update' });
    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE recurring_tasks SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Recurring task not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PATCH recurring-tasks]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', checkPermission('tasks', 'delete'), async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM recurring_tasks WHERE id = $1 RETURNING id', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Recurring task not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE recurring-tasks]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
