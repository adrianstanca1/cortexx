/**
 * 4D BIM — Time-linked 3D Model Management
 * Links BIM models to project schedules for time-based visualisation.
 *
 * Endpoints:
 *   GET  /bim4d/projects/:id/models     — list 4D BIM models for a project
 *   POST /bim4d/models                  — upload/register a 4D model
 *   GET  /bim4d/models/:id              — get model details and schedule links
 *   PUT  /bim4d/models/:id              — update model metadata
 *   GET  /bim4d/models/:id/tasks        — get BIM-to-task schedule links
 *   POST /bim4d/models/:id/tasks         — link BIM elements to schedule tasks
 *   POST /bim4d/models/:id/animate      — get animation keyframes for a date range
 */
const express = require('express');
const path    = require('path');
const crypto  = require('crypto');
const pool    = require('../db');
const authMw  = require('../middleware/auth');

const router = express.Router();
router.use(authMw);

// ─── Helpers ───────────────────────────────────────────────────────────────

function estimateSimulationDuration(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  // Keyframes at 5% intervals = ~21 keyframes
  const keyframes = Math.max(2, Math.ceil(days / 7));
  return { total_days: days, keyframes };
}

// ─── Routes ───────────────────────────────────────────────────────────────

/** GET /bim4d/projects/:id/models — list all 4D models for a project */
router.get('/projects/:id/models', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, limit = '20' } = req.query;
    const orgId   = req.user?.organization_id;
    const companyId = req.user?.company_id;
    const isSuper = req.user?.role === 'super_admin';
    const limitNum = Math.min(100, parseInt(limit, 10));

    let query, params;
    if (isSuper) {
      query = `SELECT bm.*, p.name as project_name,
               (SELECT COUNT(*) FROM bim4d_tasks WHERE model_id = bm.id) as task_count
               FROM bim4d_models bm
               JOIN projects p ON p.id = bm.project_id
               WHERE bm.project_id = $1`;
      params = [id];
    } else {
      query = `SELECT bm.*, p.name as project_name,
               (SELECT COUNT(*) FROM bim4d_tasks WHERE model_id = bm.id) as task_count
               FROM bim4d_models bm
               JOIN projects p ON p.id = bm.project_id
               WHERE bm.project_id = $1
                 AND (bm.organization_id = $2 OR (bm.organization_id IS NULL AND bm.company_id = $3))`;
      params = [id, orgId, companyId];
    }

    if (status) { query += ` AND bm.status = $${params.length + 1}`; params.push(status); }
    query += ` ORDER BY bm.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limitNum);

    const { rows } = await pool.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('[BIM4D project models]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** POST /bim4d/models — register a new 4D BIM model */
router.post('/models', async (req, res) => {
  try {
    const {
      project_id, name, description, model_url, thumbnail_url,
      ifc_version, coordinate_system, simulation_start, simulation_end,
      phase, notes
    } = req.body;

    if (!project_id || !name) {
      return res.status(400).json({ message: 'project_id and name are required' });
    }

    const orgId   = req.user?.organization_id;
    const companyId = req.user?.company_id;

    const simInfo = estimateSimulationDuration(simulation_start, simulation_end);

    const { rows } = await pool.query(
      `INSERT INTO bim4d_models (project_id, name, description, model_url, thumbnail_url, ifc_version,
                                 coordinate_system, simulation_start, simulation_end, phase, notes,
                                 organization_id, company_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'draft')
       RETURNING *`,
      [project_id, name, description || null, model_url || null, thumbnail_url || null,
       ifc_version || null, coordinate_system || null, simulation_start || null, simulation_end || null,
       phase || null, notes || null, orgId, companyId]
    );

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    console.error('[BIM4D model POST]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** GET /bim4d/models/:id — get model details */
router.get('/models/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId   = req.user?.organization_id;
    const companyId = req.user?.company_id;
    const isSuper = req.user?.role === 'super_admin';

    let query, params;
    if (isSuper) {
      query = `SELECT bm.*, p.name as project_name FROM bim4d_models bm
               JOIN projects p ON p.id = bm.project_id WHERE bm.id = $1`;
      params = [id];
    } else {
      query = `SELECT bm.*, p.name as project_name FROM bim4d_models bm
               JOIN projects p ON p.id = bm.project_id
               WHERE bm.id = $1
                 AND (bm.organization_id = $2 OR (bm.organization_id IS NULL AND bm.company_id = $3))`;
      params = [id, orgId, companyId];
    }

    const { rows } = await pool.query(query, params);
    if (!rows.length) return res.status(404).json({ message: 'Model not found' });
    res.json({ data: rows[0] });
  } catch (err) {
    console.error('[BIM4D model GET]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** PUT /bim4d/models/:id — update model metadata */
router.put('/models/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, model_url, thumbnail_url, status, phase, notes } = req.body;
    const orgId   = req.user?.organization_id;
    const companyId = req.user?.company_id;

    const updates = [];
    const params = [];
    let i = 1;
    if (name !== undefined)         { updates.push(`name = $${i++}`); params.push(name); }
    if (description !== undefined)  { updates.push(`description = $${i++}`); params.push(description); }
    if (model_url !== undefined)   { updates.push(`model_url = $${i++}`); params.push(model_url); }
    if (thumbnail_url !== undefined) { updates.push(`thumbnail_url = $${i++}`); params.push(thumbnail_url); }
    if (status !== undefined)      { updates.push(`status = $${i++}`); params.push(status); }
    if (phase !== undefined)        { updates.push(`phase = $${i++}`); params.push(phase); }
    if (notes !== undefined)        { updates.push(`notes = $${i++}`); params.push(notes); }

    if (!updates.length) return res.status(400).json({ message: 'No fields to update' });

    params.push(id, orgId, companyId);
    const { rows } = await pool.query(
      `UPDATE bim4d_models SET ${updates.join(', ')}
       WHERE id = $${params.length - 1}
         AND (organization_id = $${params.length} OR (organization_id IS NULL AND company_id = $${params.length + 1}))
       RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ message: 'Model not found' });
    res.json({ data: rows[0] });
  } catch (err) {
    console.error('[BIM4D model PUT]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** GET /bim4d/models/:id/tasks — get all BIM-to-schedule task links */
router.get('/models/:id/tasks', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId   = req.user?.organization_id;
    const companyId = req.user?.company_id;
    const isSuper = req.user?.role === 'super_admin';

    let query, params;
    if (isSuper) {
      query = `SELECT bt.*, pt.task_name, pt.start_date, pt.end_date, pt.status as task_status,
                      pt.percent_complete
               FROM bim4d_tasks bt
               LEFT JOIN project_tasks pt ON pt.id = bt.task_id
               WHERE bt.model_id = $1
               ORDER BY pt.start_date ASC NULLS LAST`;
      params = [id];
    } else {
      query = `SELECT bt.*, pt.task_name, pt.start_date, pt.end_date, pt.status as task_status,
                      pt.percent_complete
               FROM bim4d_tasks bt
               LEFT JOIN project_tasks pt ON pt.id = bt.task_id
               JOIN bim4d_models bm ON bm.id = bt.model_id
               LEFT JOIN projects p ON p.id = bm.project_id
               WHERE bt.model_id = $1
                 AND (bm.organization_id = $2 OR (bm.organization_id IS NULL AND bm.company_id = $3))
               ORDER BY pt.start_date ASC NULLS LAST`;
      params = [id, orgId, companyId];
    }

    const { rows } = await pool.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('[BIM4D tasks GET]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** POST /bim4d/models/:id/tasks — link BIM elements to schedule tasks */
router.post('/models/:id/tasks', async (req, res) => {
  try {
    const { id } = req.params;
    const { element_ids = [], task_id, start_date, end_date, colour, notes } = req.body;

    if (!element_ids.length || !task_id) {
      return res.status(400).json({ message: 'element_ids array and task_id are required' });
    }

    const orgId   = req.user?.organization_id;
    const companyId = req.user?.company_id;

    // Verify model ownership
    const { rows: models } = await pool.query(
      `SELECT id FROM bim4d_models WHERE id = $1 AND (organization_id = $2 OR (organization_id IS NULL AND company_id = $3))`,
      [id, orgId, companyId]
    );
    if (!models.length) return res.status(404).json({ message: 'Model not found' });

    // Batch insert element-task links
    const values = element_ids.map(elId =>
      `($$1, $2, $3, $4, $5, $6, $7)`
    ).join(', ');
    const params = [id, task_id, JSON.stringify(element_ids), start_date || null, end_date || null, colour || null, notes || null];

    const { rows } = await pool.query(
      `INSERT INTO bim4d_tasks (model_id, task_id, element_ids, start_date, end_date, colour, notes)
       VALUES ${values}
       ON CONFLICT (model_id, task_id) DO UPDATE SET
         element_ids = EXCLUDED.element_ids,
         start_date = EXCLUDED.start_date,
         end_date = EXCLUDED.end_date,
         colour = EXCLUDED.colour,
         notes = EXCLUDED.notes
       RETURNING *`,
      params
    );

    res.status(201).json({ data: rows });
  } catch (err) {
    console.error('[BIM4D tasks POST]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** POST /bim4d/models/:id/animate — get keyframes for a date range */
router.post('/models/:id/animate', async (req, res) => {
  try {
    const { id } = req.params;
    const { from_date, to_date, granularity = 'daily' } = req.body;

    if (!from_date || !to_date) {
      return res.status(400).json({ message: 'from_date and to_date are required' });
    }

    const orgId   = req.user?.organization_id;
    const companyId = req.user?.company_id;

    // Verify model access
    const { rows: models } = await pool.query(
      `SELECT bm.*, p.name as project_name, p.start_date as proj_start, p.end_date as proj_end
       FROM bim4d_models bm JOIN projects p ON p.id = bm.project_id
       WHERE bm.id = $1 AND (bm.organization_id = $2 OR (bm.organization_id IS NULL AND bm.company_id = $3))`,
      [id, orgId, companyId]
    );
    if (!models.length) return res.status(404).json({ message: 'Model not found' });

    const model = models[0];

    // Get all task links within date range
    const { rows: tasks } = await pool.query(
      `SELECT bt.*, pt.task_name, pt.start_date, pt.end_date, pt.status as task_status, pt.percent_complete
       FROM bim4d_tasks bt
       LEFT JOIN project_tasks pt ON pt.id = bt.task_id
       WHERE bt.model_id = $1
         AND (bt.end_date >= $2 AND bt.start_date <= $3)`,
      [id, from_date, to_date]
    );

    // Generate keyframes
    const from = new Date(from_date);
    const to = new Date(to_date);
    const dayMs = 24 * 60 * 60 * 1000;

    // Granularity: daily, weekly, biweekly
    const intervalDays = granularity === 'weekly' ? 7 : granularity === 'biweekly' ? 14 : 1;
    const keyframes = [];
    let current = new Date(from);

    while (current <= to) {
      const dateStr = current.toISOString().split('T')[0];
      const activeTasks = tasks.filter(t => {
        const start = t.start_date ? new Date(t.start_date) : null;
        const end = t.end_date ? new Date(t.end_date) : null;
        if (start && current < start) return false;
        if (end && current > end) return false;
        return true;
      });

      keyframes.push({
        date: dateStr,
        active_elements: activeTasks.flatMap(t => {
          try { return JSON.parse(t.element_ids); } catch { return []; }
        }),
        active_tasks: activeTasks.map(t => ({
          task_id: t.task_id,
          task_name: t.task_name,
          colour: t.colour,
          progress_pct: t.percent_complete || 0,
        })),
        active_count: activeTasks.length,
      });

      current = new Date(current.getTime() + intervalDays * dayMs);
    }

    res.json({
      model_id: id,
      project_name: model.project_name,
      from_date,
      to_date,
      granularity,
      total_keyframes: keyframes.length,
      keyframes,
    });
  } catch (err) {
    console.error('[BIM4D animate]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
