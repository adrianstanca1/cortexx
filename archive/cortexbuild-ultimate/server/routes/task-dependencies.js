const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { checkPermission } = require('../middleware/checkPermission');

const router = express.Router();
router.use(authMiddleware);

router.get('/', checkPermission('tasks', 'read'), async (req, res) => {
  try {
    const { task_id } = req.query;
    if (!task_id) return res.status(400).json({ message: 'task_id is required' });
    const { rows } = await pool.query(
      `SELECT td.*, t.title as depends_on_title FROM task_dependencies td
       JOIN tasks t ON td.depends_on_id = t.id WHERE td.task_id = $1`,
      [task_id]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('[GET task-dependencies]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', checkPermission('tasks', 'create'), async (req, res) => {
  try {
    const { task_id, depends_on_id, dependency_type } = req.body;
    if (!task_id || !depends_on_id) return res.status(400).json({ message: 'task_id and depends_on_id are required' });
    if (String(task_id) === String(depends_on_id)) return res.status(400).json({ message: "A task can't depend on itself" });
    const { rows } = await pool.query(
      'INSERT INTO task_dependencies (task_id, depends_on_id, dependency_type) VALUES ($1,$2,$3) RETURNING *',
      [task_id, depends_on_id, dependency_type || 'finish_to_start']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.message && err.message.includes('unique')) return res.status(409).json({ message: 'Dependency already exists' });
    console.error('[POST task-dependencies]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', checkPermission('tasks', 'delete'), async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM task_dependencies WHERE id = $1 RETURNING id', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Dependency not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE task-dependencies]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
