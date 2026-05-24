const express = require('express');
const pool    = require('../db');
const authMiddleware = require('../middleware/auth');
const { buildTenantFilter, isSuperAdmin, isCompanyOwner } = require('../middleware/tenantFilter');

const router = express.Router();
router.use(authMiddleware);

// Multi-tenancy: use centralized buildTenantFilter with COALESCE
function orgFilterTasks(req) {
  const { clause, params } = buildTenantFilter(req, 'AND', 'p');
  if (!clause) return { join: '', filter: '', params: [] };
  return {
    join: 'JOIN projects p ON pt.project_id = p.id',
    filter: clause,
    params,
  };
}

// ─── GET /api/project-tasks?project_id=xxx&status=todo ───────────────────────
router.get('/', async (req, res) => {
  try {
    const { project_id, status, priority, assigned_to } = req.query;
    const { join, filter, params } = await orgFilterTasks(req);
    const baseParamsLen = params.length;

    let query = `SELECT pt.* FROM project_tasks pt ${join} WHERE 1=1${filter}`;
    const queryParams = [...params];

    if (project_id) {
      queryParams.push(project_id);
      query += ` AND pt.project_id = $${queryParams.length}`;
    }
    if (status) {
      queryParams.push(status);
      query += ` AND pt.status = $${queryParams.length}`;
    }
    if (priority) {
      queryParams.push(priority);
      query += ` AND pt.priority = $${queryParams.length}`;
    }
    if (assigned_to) {
      queryParams.push(assigned_to);
      query += ` AND pt.assigned_to = $${queryParams.length}`;
    }

    query += ' ORDER BY pt.created_at DESC';
    const { rows } = await pool.query(query, queryParams);
    res.json({ data: rows });
  } catch (err) {
    console.error('[GET /api/project-tasks]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── POST /api/project-tasks ─────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      project_id, title, description, status, priority,
      assigned_to, due_date, category, estimated_hours, tags
    } = req.body;

    if (!title) return res.status(400).json({ message: 'Title is required' });

    // Verify project belongs to user's tenant
    if (project_id && (req.user?.organization_id || req.user?.company_id)) {
      const tenantCol = req.user?.role === 'company_owner' ? 'company_id' : 'organization_id';
      const tenantId = req.user?.role === 'company_owner' ? req.user.company_id : req.user.organization_id;
      const { rows: proj } = await pool.query(
        `SELECT id FROM projects WHERE id = $1 AND COALESCE(organization_id, company_id) = $2`,
        [project_id, tenantId]
      );
      if (proj.length === 0) {
        return res.status(403).json({ message: 'Project not found or access denied' });
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO project_tasks
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
    console.error('[POST /api/project-tasks]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── GET /api/project-tasks/:id ──────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { join, filter, params } = await orgFilterTasks(req);
    const { rows } = await pool.query(
      `SELECT pt.* FROM project_tasks pt ${join} WHERE pt.id = $${params.length + 1}${filter}`,
      [...params, id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Task not found' });

    const { clause: commentClause, params: commentParams } = buildTenantFilter(req, 'AND', null, 2);
    const { rows: comments } = await pool.query(
      `SELECT * FROM project_task_comments WHERE task_id = $1${commentClause} ORDER BY created_at ASC`,
      [id, ...commentParams]
    );

    res.json({ ...rows[0], comments });
  } catch (err) {
    console.error('[GET /api/project-tasks/:id]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── PUT /api/project-tasks/:id ─────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, description, status, priority, assigned_to,
      due_date, category, estimated_hours, tags, progress
    } = req.body;

    const { params: baseParams } = await orgFilterTasks(req);
    const queryParams = [...baseParams];
    const updates = [];

    const ALLOWED_FIELDS = ['title', 'description', 'status', 'priority', 'assigned_to', 'due_date', 'category', 'estimated_hours', 'tags', 'progress'];
    const fields = {
      title, description, status, priority, assigned_to,
      due_date, category, estimated_hours, tags, progress
    };

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && ALLOWED_FIELDS.includes(key)) {
        queryParams.push(value);
        updates.push(`${key} = $${queryParams.length}`);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    queryParams.push(id);
    const idParamIndex = queryParams.length; // $N where id landed (1-indexed)

    const { rows } = await pool.query(
      `UPDATE project_tasks pt SET ${updates.join(', ')}
       FROM projects p
       WHERE p.id = pt.project_id AND COALESCE(p.organization_id, p.company_id) = $1 AND pt.id = $${idParamIndex}
       RETURNING pt.*`,
      queryParams
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('[PUT /api/project-tasks/:id]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── DELETE /api/project-tasks/:id ──────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { filter, params: baseParams } = await orgFilterTasks(req);
    const idParamIndex = baseParams.length + 1;

    const { rows } = await pool.query(
      `DELETE FROM project_tasks pt USING projects p
       WHERE p.id = pt.project_id ${filter} AND pt.id = $${idParamIndex}
       RETURNING pt.id`,
      [...baseParams, id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Task not found' });

    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error('[DELETE /api/project-tasks/:id]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── POST /api/project-tasks/:id/comments ───────────────────────────────────
router.post('/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const author = req.user?.name || req.user?.email || 'Unknown';

    if (!comment) return res.status(400).json({ message: 'Comment is required' });

    // Verify task belongs to user's org
    const { filter, params: baseParams } = await orgFilterTasks(req);
    const idParamIndex = baseParams.length + 1;
    const { rows: task } = await pool.query(
      `SELECT pt.id FROM project_tasks pt
       JOIN projects p ON p.id = pt.project_id
       WHERE 1=1 ${filter} AND pt.id = $${idParamIndex}`,
      [...baseParams, id]
    );
    if (task.length === 0) return res.status(404).json({ message: 'Task not found' });

    const { rows } = await pool.query(
      `INSERT INTO project_task_comments (task_id, comment, author, organization_id, company_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, comment, author, req.user.organization_id, req.user.company_id]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /api/project-tasks/:id/comments]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── PUT /api/project-tasks/bulk-status ─────────────────────────────────────
router.put('/bulk-status', async (req, res) => {
  try {
    const { ids, status } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids array is required' });
    }
    if (!status) return res.status(400).json({ message: 'status is required' });

    const { filter, params: baseParams } = await orgFilterTasks(req);
    const placeholders = ids.map((_, i) => `$${baseParams.length + 1 + i}`).join(', ');
    const statusParamIndex = baseParams.length + ids.length + 1;
    const { rows } = await pool.query(
      `UPDATE project_tasks pt SET status = $${statusParamIndex}
       FROM projects p
       WHERE p.id = pt.project_id ${filter} AND pt.id IN (${placeholders})
       RETURNING pt.*`,
      [...baseParams, ...ids, status]
    );

    res.json({ updated: rows.length, data: rows });
  } catch (err) {
    console.error('[PUT /api/project-tasks/bulk-status]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
