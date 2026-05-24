/**
 * server/routes/workflows.js
 * REST API for workflow management
 */

const express = require('express');
const { v4: uuid } = require('uuid');
const pool = require('../db');
const auth = require('../middleware/auth');
const { dispatch } = require('../lib/workflow/dispatcher');
const { runWorkflow } = require('../lib/workflow/runner');

const router = express.Router();
router.use(auth);

/**
 * Validate workflow shape
 */
function validateWorkflow(body) {
  const errors = [];

  if (typeof body.name !== 'string' || !body.name.trim()) {
    errors.push('name is required and must be a non-empty string');
  }

  if (!body.trigger || typeof body.trigger !== 'object') {
    errors.push('trigger is required and must be an object');
  } else {
    if (!body.trigger.type || body.trigger.type !== 'event') {
      errors.push('trigger.type must be "event"');
    }
    if (!body.trigger.event || typeof body.trigger.event !== 'string') {
      errors.push('trigger.event is required and must be a string');
    }
  }

  if (!Array.isArray(body.conditions) && (!body.conditions || typeof body.conditions !== 'object')) {
    errors.push('conditions must be an array or condition group object');
  }

  if (!Array.isArray(body.actions)) {
    errors.push('actions must be an array');
  } else {
    for (let i = 0; i < body.actions.length; i++) {
      const action = body.actions[i];
      if (!action.type || typeof action.type !== 'string') {
        errors.push(`actions[${i}].type is required and must be a string`);
      }
      if (!action.params || typeof action.params !== 'object') {
        errors.push(`actions[${i}].params is required and must be an object`);
      }
    }
  }

  return errors;
}

/**
 * GET /api/workflows
 * List workflows for organization
 */
router.get('/', async (req, res) => {
  try {
    const orgId = req.user?.organization_id || req.user?.company_id;
    if (!orgId) {
      return res.status(403).json({ message: 'No organization context' });
    }

    const { rows } = await pool.query(
      `SELECT id, name, description, trigger, conditions, actions, enabled, created_by, created_at, updated_at
       FROM workflows
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [orgId]
    );

    // Parse JSON fields
    const workflows = rows.map((w) => ({
      ...w,
      trigger: typeof w.trigger === 'string' ? JSON.parse(w.trigger) : w.trigger,
      conditions: typeof w.conditions === 'string' ? JSON.parse(w.conditions) : w.conditions,
      actions: typeof w.actions === 'string' ? JSON.parse(w.actions) : w.actions,
    }));

    res.json({ workflows, total: workflows.length });
  } catch (err) {
    console.error('[workflows GET]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /api/workflows
 * Create a new workflow
 */
router.post('/', async (req, res) => {
  try {
    const orgId = req.user?.organization_id || req.user?.company_id;
    if (!orgId) {
      return res.status(403).json({ message: 'No organization context' });
    }

    const { name, description, trigger, conditions = [], actions = [], enabled = true } = req.body;

    // Validate
    const errors = validateWorkflow({ name, trigger, conditions, actions });
    if (errors.length) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    const id = uuid();
    const { rows } = await pool.query(
      `INSERT INTO workflows (id, organization_id, name, description, trigger, conditions, actions, enabled, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, description, trigger, conditions, actions, enabled, created_by, created_at, updated_at`,
      [
        id,
        orgId,
        name.trim(),
        description || null,
        JSON.stringify(trigger),
        JSON.stringify(conditions),
        JSON.stringify(actions),
        enabled,
        req.user?.id || null,
      ]
    );

    const workflow = rows[0];
    res.status(201).json({
      workflow: {
        ...workflow,
        trigger: JSON.parse(workflow.trigger),
        conditions: JSON.parse(workflow.conditions),
        actions: JSON.parse(workflow.actions),
      },
    });
  } catch (err) {
    if (err.code === '23505') {
      // Unique violation
      return res.status(409).json({ message: 'A workflow with that name already exists' });
    }
    console.error('[workflows POST]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /api/workflows/:id
 * Fetch workflow with last 20 runs
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organization_id || req.user?.company_id;

    const { rows: workflows } = await pool.query(
      `SELECT id, name, description, trigger, conditions, actions, enabled, created_by, created_at, updated_at
       FROM workflows
       WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    );

    if (!workflows.length) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    const workflow = workflows[0];

    // Fetch last 20 runs
    const { rows: runs } = await pool.query(
      `SELECT id, status, result, error, started_at, completed_at
       FROM workflow_runs
       WHERE workflow_id = $1
       ORDER BY started_at DESC
       LIMIT 20`,
      [id]
    );

    const parsedRuns = runs.map((r) => ({
      ...r,
      result: r.result ? JSON.parse(r.result) : null,
    }));

    res.json({
      workflow: {
        ...workflow,
        trigger: JSON.parse(workflow.trigger),
        conditions: JSON.parse(workflow.conditions),
        actions: JSON.parse(workflow.actions),
      },
      runs: parsedRuns,
    });
  } catch (err) {
    console.error('[workflows GET/:id]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * PATCH /api/workflows/:id
 * Update workflow
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organization_id || req.user?.company_id;
    const { name, description, trigger, conditions, actions, enabled } = req.body;

    // Build update query dynamically
    const updates = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(description || null);
    }
    if (trigger !== undefined) {
      updates.push(`trigger = $${idx++}`);
      values.push(JSON.stringify(trigger));
    }
    if (conditions !== undefined) {
      updates.push(`conditions = $${idx++}`);
      values.push(JSON.stringify(conditions));
    }
    if (actions !== undefined) {
      updates.push(`actions = $${idx++}`);
      values.push(JSON.stringify(actions));
    }
    if (enabled !== undefined) {
      updates.push(`enabled = $${idx++}`);
      values.push(enabled);
    }

    if (!updates.length) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    values.push(id);
    values.push(orgId);

    const { rows } = await pool.query(
      `UPDATE workflows
       SET ${updates.join(', ')}
       WHERE id = $${idx++} AND organization_id = $${idx++}
       RETURNING id, name, description, trigger, conditions, actions, enabled, created_by, created_at, updated_at`,
      values
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    const workflow = rows[0];
    res.json({
      workflow: {
        ...workflow,
        trigger: JSON.parse(workflow.trigger),
        conditions: JSON.parse(workflow.conditions),
        actions: JSON.parse(workflow.actions),
      },
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'A workflow with that name already exists' });
    }
    console.error('[workflows PATCH/:id]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * DELETE /api/workflows/:id
 * Soft delete workflow (set enabled=false)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organization_id || req.user?.company_id;

    const { rows } = await pool.query(
      `UPDATE workflows SET enabled = false WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [id, orgId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    res.json({ message: 'Workflow disabled', id: rows[0].id });
  } catch (err) {
    console.error('[workflows DELETE/:id]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /api/workflows/:id/test-run
 * Execute workflow with synthetic trigger payload
 */
router.post('/:id/test-run', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organization_id || req.user?.company_id;
    const { payload = {} } = req.body;

    const { rows: workflows } = await pool.query(
      `SELECT id, trigger, conditions, actions FROM workflows WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    );

    if (!workflows.length) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    const workflow = workflows[0];
    workflow.trigger = JSON.parse(workflow.trigger);
    workflow.conditions = JSON.parse(workflow.conditions);
    workflow.actions = JSON.parse(workflow.actions);

    const result = await runWorkflow(workflow, payload, { pool, user: req.user });

    res.json({ run: result });
  } catch (err) {
    console.error('[workflows POST/:id/test-run]', err.message);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
});

module.exports = router;
