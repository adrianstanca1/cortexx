const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { checkPermission } = require('../middleware/checkPermission');
const { buildTenantFilter, isSuperAdmin, isCompanyOwner } = require('../middleware/tenantFilter');

const router = express.Router();
router.use(authMiddleware);

// GET /api/task-templates
router.get('/', checkPermission('tasks', 'read'), async (req, res) => {
  try {
    const { clause, params } = buildTenantFilter(req, 'WHERE');
    const query = `SELECT * FROM task_templates${clause} ORDER BY created_at DESC`;
    const { rows } = await pool.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('[GET task-templates]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', checkPermission('tasks', 'create'), async (req, res) => {
  try {
    const { name, title_pattern, description_template, category, estimated_hours, checklist } = req.body;
    if (!name || !title_pattern) return res.status(400).json({ message: 'name and title_pattern are required' });
    const orgId = req.user.organization_id || null;
    const compId = req.user.company_id || null;
    const { rows } = await pool.query(
      `INSERT INTO task_templates (organization_id, company_id, name, title_pattern, description_template, category, estimated_hours, checklist)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [orgId, compId, name, title_pattern, description_template || '', category || 'general', estimated_hours || null, JSON.stringify(checklist || [])]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST task-templates]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', checkPermission('tasks', 'update'), async (req, res) => {
  try {
    const { name, title_pattern, description_template, category, estimated_hours, checklist } = req.body;
    const fields = [];
    const vals = [];
    let idx = 1;
    if (name !== undefined) { fields.push(`name = $${idx++}`); vals.push(name); }
    if (title_pattern !== undefined) { fields.push(`title_pattern = $${idx++}`); vals.push(title_pattern); }
    if (description_template !== undefined) { fields.push(`description_template = $${idx++}`); vals.push(description_template); }
    if (category !== undefined) { fields.push(`category = $${idx++}`); vals.push(category); }
    if (estimated_hours !== undefined) { fields.push(`estimated_hours = $${idx++}`); vals.push(estimated_hours); }
    if (checklist !== undefined) { fields.push(`checklist = $${idx++}`); vals.push(JSON.stringify(checklist)); }
    if (fields.length === 0) return res.status(400).json({ message: 'No fields to update' });
    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE task_templates SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Task template not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PUT task-templates]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', checkPermission('tasks', 'delete'), async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM task_templates WHERE id = $1 RETURNING id', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Task template not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE task-templates]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
