const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { checkPermission } = require('../middleware/checkPermission');
const { buildTenantFilter } = require('../middleware/tenantFilter');

const router = express.Router();
router.use(authMiddleware);

// GET /api/subtasks?task_id=...
router.get('/', checkPermission('tasks', 'read'), async (req, res) => {
  try {
    const { task_id } = req.query;
    if (!task_id) return res.status(400).json({ message: 'task_id is required' });
    const { rows } = await pool.query(
      'SELECT * FROM subtasks WHERE task_id = $1 ORDER BY sort_order, created_at',
      [task_id]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('[GET /api/subtasks]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', checkPermission('tasks', 'create'), async (req, res) => {
  try {
    const { task_id, title, done, sort_order } = req.body;
    if (!task_id || !title) return res.status(400).json({ message: 'task_id and title are required' });
    const { rows } = await pool.query(
      'INSERT INTO subtasks (task_id, title, done, sort_order) VALUES ($1,$2,$3,$4) RETURNING *',
      [task_id, title, done || false, sort_order || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /api/subtasks]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/:id', checkPermission('tasks', 'update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, done, sort_order } = req.body;
    const fields = [];
    const vals = [];
    let idx = 1;
    if (title !== undefined) { fields.push(`title = $${idx++}`); vals.push(title); }
    if (done !== undefined) { fields.push(`done = $${idx++}`); vals.push(done); }
    if (sort_order !== undefined) { fields.push(`sort_order = $${idx++}`); vals.push(sort_order); }
    if (fields.length === 0) return res.status(400).json({ message: 'No fields to update' });
    vals.push(id);
    const { rows } = await pool.query(
      `UPDATE subtasks SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Subtask not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PATCH /api/subtasks/:id]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', checkPermission('tasks', 'delete'), async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM subtasks WHERE id = $1 RETURNING id', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Subtask not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/subtasks/:id]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
