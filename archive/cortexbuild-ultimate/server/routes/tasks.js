const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { checkPermission } = require('../middleware/checkPermission');
const { buildTenantFilter, isSuperAdmin, isCompanyOwner } = require('../middleware/tenantFilter');

const router = express.Router();
router.use(authMiddleware);

const VALID_STATUSES = ['todo', 'in_progress', 'review', 'done', 'blocked'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

function safeJson(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return value; }
  }
  return JSON.stringify(value);
}

// ─── GET /api/tasks?projectId=xxx&status=xxx ───────────────────────────────
router.get('/', checkPermission('tasks', 'read'), async (req, res) => {
  try {
    const { projectId, status, priority, assigned_to } = req.query;
    const { clause: tenantClause, params: tenantParams } = buildTenantFilter(req, 'AND', 'p');
    const needsJoin = tenantClause || projectId;
    const join = needsJoin ? 'JOIN projects p ON t.project_id = p.id' : '';
    const queryParams = [...tenantParams];

    let query = `SELECT t.* FROM tasks t ${join} WHERE 1=1${tenantClause}`;

    if (projectId) {
      queryParams.push(projectId);
      query += ` AND t.project_id = $${queryParams.length}`;
    }
    if (status) {
      queryParams.push(status);
      query += ` AND t.status = $${queryParams.length}`;
    }
    if (priority) {
      queryParams.push(priority);
      query += ` AND t.priority = $${queryParams.length}`;
    }
    if (assigned_to) {
      queryParams.push(assigned_to);
      query += ` AND t.assigned_to = $${queryParams.length}`;
    }

    query += ' ORDER BY t.created_at DESC';
    const { rows } = await pool.query(query, queryParams);
    res.json({ data: rows });
  } catch (err) {
    console.error('[GET /api/tasks]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── POST /api/tasks ───────────────────────────────────────────────────────
router.post('/', checkPermission('tasks', 'create'), async (req, res) => {
  try {
    const {
      project_id, title, description, status, priority,
      assigned_to, due_date, category, estimated_hours, tags
    } = req.body;

    const isCompanyOwnerFlag = isCompanyOwner(req);
    const tenantId = isCompanyOwnerFlag ? req.user.company_id : req.user.organization_id;

    if (!tenantId && !isSuperAdmin(req)) {
      return res.status(400).json({ message: 'User profile incomplete. Please complete your profile setup.' });
    }

    if (!title) return res.status(400).json({ message: 'Title is required' });

    // Validate status and priority
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Valid values: ${VALID_STATUSES.join(', ')}` });
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ message: `Invalid priority. Valid values: ${VALID_PRIORITIES.join(', ')}` });
    }

    // Verify project belongs to user's tenant (IDOR protection)
    if (project_id && !isSuperAdmin(req)) {
      const { clause: projClause, params: projParams } = buildTenantFilter(req, 'AND');
      const { rows: proj } = await pool.query(
        `SELECT id FROM projects WHERE id = $1${projClause}`,
        [project_id, ...projParams]
      );
      if (proj.length === 0) {
        return res.status(403).json({ message: 'Project not found or access denied' });
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO tasks
        (project_id, title, description, status, priority, assigned_to, due_date, category, estimated_hours, tags, organization_id, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        project_id || null,
        title,
        description || '',
        status || 'todo',
        priority || 'medium',
        assigned_to || null,
        due_date || null,
        category || 'general',
        estimated_hours || null,
        tags || '',
        req.user.organization_id || null,
        req.user.company_id || null
      ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /api/tasks]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── GET /api/tasks/:id ────────────────────────────────────────────────────
router.get('/:id', checkPermission('tasks', 'read'), async (req, res) => {
  try {
    const { id } = req.params;
    const { clause: tenantClause, params: tenantParams } = buildTenantFilter(req, 'AND', 'p');
    const needsJoin = !!tenantClause;
    const join = needsJoin ? 'JOIN projects p ON t.project_id = p.id' : '';
    const { rows } = await pool.query(
      `SELECT t.* FROM tasks t ${join} WHERE t.id = $${tenantParams.length + 1}${tenantClause}`,
      [...tenantParams, id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Task not found' });

    res.json(rows[0]);
  } catch (err) {
    console.error('[GET /api/tasks/:id]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── PUT /api/tasks/:id ────────────────────────────────────────────────────
router.put('/:id', checkPermission('tasks', 'update'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, description, status, priority, assigned_to,
      due_date, category, estimated_hours, tags, progress
    } = req.body;

    // Validate status and priority if provided
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Valid values: ${VALID_STATUSES.join(', ')}` });
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ message: `Invalid priority. Valid values: ${VALID_PRIORITIES.join(', ')}` });
    }

    const tf = buildTenantFilter(req, 'AND', 'p');
    const updates = [];
    const queryParams = [];

    const ALLOWED_FIELDS = ['title', 'description', 'status', 'priority', 'assigned_to', 'due_date', 'category', 'estimated_hours', 'tags', 'progress', 'checklist', 'time_spent', 'parent_task_id'];
    const fields = {
      title, description, status, priority, assigned_to,
      due_date, category, estimated_hours, tags, progress, checklist, time_spent, parent_task_id
    };

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && ALLOWED_FIELDS.includes(key)) {
        updates.push(`${key} = $${queryParams.length + 1}`);
        queryParams.push(value);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    queryParams.push(id);

    // Build WHERE clause dynamically based on role
    let queryText;
    if (isSuperAdmin(req)) {
      // super_admin can update any task — no need to join projects
      queryText = `UPDATE tasks SET ${updates.join(', ')}
        WHERE id = $${queryParams.length}
        RETURNING *`;
    } else {
      const tfLen = tf.params.length;
      queryParams.push(...tf.params);
      const idPlaceholder = queryParams.length - tfLen;
      queryText = `UPDATE tasks t SET ${updates.join(', ')}
        FROM projects p
        WHERE p.id = t.project_id${tf.clause} AND t.id = $${idPlaceholder}
        RETURNING t.*`;
    }

    const { rows } = await pool.query(queryText, queryParams);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('[PUT /api/tasks/:id]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── DELETE /api/tasks/:id ─────────────────────────────────────────────────
router.delete('/:id', checkPermission('tasks', 'delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const { clause: tenantClause, params: tenantParams } = buildTenantFilter(req, 'AND', 'p');

    let query, queryParams;
    if (isSuperAdmin(req)) {
      query = 'DELETE FROM tasks WHERE id = $1 RETURNING id';
      queryParams = [id];
    } else {
      query = `DELETE FROM tasks t USING projects p
               WHERE p.id = t.project_id AND t.id = $1${tenantClause}
               RETURNING t.id`;
      queryParams = [id, ...tenantParams];
    }

    const { rows } = await pool.query(query, queryParams);
    if (rows.length === 0) return res.status(404).json({ message: 'Task not found' });

    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error('[DELETE /api/tasks/:id]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── PATCH /api/tasks/:id/checklist ─────────────────────────────────────────
router.patch('/:id/checklist', checkPermission('tasks', 'update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { checklist } = req.body;
    if (!Array.isArray(checklist)) return res.status(400).json({ message: 'checklist must be an array' });
    const tf = buildTenantFilter(req, 'AND', 'p');
    let query, params;
    if (isSuperAdmin(req)) {
      query = 'UPDATE tasks SET checklist = $1 WHERE id = $2 RETURNING *';
      params = [JSON.stringify(checklist), id];
    } else {
      query = 'UPDATE tasks t SET checklist = $1 FROM projects p WHERE p.id = t.project_id AND t.id = $2' + tf.clause + ' RETURNING t.*';
      params = [JSON.stringify(checklist), id, ...tf.params];
    }
    const { rows } = await pool.query(query, params);
    if (rows.length === 0) return res.status(404).json({ message: 'Task not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PATCH /api/tasks/:id/checklist]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── POST /api/tasks/bulk-status ────────────────────────────────────────────
router.post('/bulk-status', checkPermission('tasks', 'update'), async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'ids array required' });
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ message: `Invalid status. Valid values: ${VALID_STATUSES.join(', ')}` });
    const tf = buildTenantFilter(req, 'AND', 'p');
    let query, params;
    if (isSuperAdmin(req)) {
      const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
      query = `UPDATE tasks SET status = $1 WHERE id IN (${placeholders}) RETURNING id`;
      params = [status, ...ids];
    } else {
      const placeholders = ids.map((_, i) => `$${i + 3}`).join(',');
      query = `UPDATE tasks t SET status = $1 FROM projects p WHERE p.id = t.project_id AND t.id IN (${placeholders})` + tf.clause + ' RETURNING t.id';
      params = [status, ...ids, ...tf.params];
    }
    const { rows } = await pool.query(query, params);
    res.json({ updated: rows.length, ids: rows.map(r => r.id) });
  } catch (err) {
    console.error('[POST /api/tasks/bulk-status]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;