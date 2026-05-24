/**
 * server/lib/workflow/runner.js
 * Core workflow execution engine
 */

const { evaluateConditions } = require('./condition-evaluator');
const { getHandler } = require('./action-registry');

/**
 * Run a workflow end-to-end
 * @param {Object} workflow - Workflow record from DB { id, actions, conditions, ... }
 * @param {Object} triggerEvent - Payload that triggered the workflow
 * @param {Object} deps - Dependencies { pool, logger, user }
 * @returns {Promise<Object>} WorkflowRunResult
 */
async function runWorkflow(workflow, triggerEvent, deps = {}) {
  const { pool, logger } = deps;
  const runId = require('uuid').v4();

  try {
    // 1. Create workflow_runs record with status=running
    await pool.query(
      `INSERT INTO workflow_runs (id, workflow_id, trigger_event, status, started_at)
       VALUES ($1, $2, $3, 'running', NOW())`,
      [runId, workflow.id, JSON.stringify(triggerEvent)]
    );

    if (logger) logger.info(`[workflow] Started run ${runId} for workflow ${workflow.id}`);

    // 2. Evaluate conditions
    const context = { event: triggerEvent, workflow, user: deps.user || {} };

    if (!evaluateConditions(workflow.conditions, context)) {
      // Conditions failed — mark as skipped
      await pool.query(
        `UPDATE workflow_runs SET status = 'skipped', completed_at = NOW() WHERE id = $1`,
        [runId]
      );
      if (logger) logger.info(`[workflow] Run ${runId} skipped (conditions not met)`);
      return {
        id: runId,
        workflow_id: workflow.id,
        status: 'skipped',
        action_results: [],
        completed_at: new Date(),
      };
    }

    // 3. Execute actions sequentially
    const actionResults = [];
    let firstError = null;
    const actions = workflow.actions || [];

    for (const action of actions) {
      const handler = getHandler(action.type);
      if (!handler) {
        const errMsg = `Unknown action type: ${action.type}`;
        firstError = firstError || errMsg;
        actionResults.push({ ok: false, error: errMsg });
        if (!action.continueOnError) break;
        continue;
      }

      let actionResult;
      try {
        actionResult = await handler(action, context, deps);
      } catch (err) {
        actionResult = { ok: false, error: err.message };
      }

      actionResults.push(actionResult);
      if (logger) {
        logger.info(
          `[workflow] Action ${action.type} in run ${runId}: ${actionResult.ok ? 'success' : 'failed'}`
        );
      }

      // Stop on first failure unless continueOnError
      if (!actionResult.ok) {
        firstError = firstError || actionResult.error;
        if (!action.continueOnError) break;
      }
    }

    // 4. Update workflow_runs with final status
    const finalStatus = firstError ? 'failed' : 'succeeded';
    const result = {
      action_results: actionResults,
      error: firstError || null,
    };

    await pool.query(
      `UPDATE workflow_runs
       SET status = $1, result = $2, error = $3, completed_at = NOW()
       WHERE id = $4`,
      [finalStatus, JSON.stringify(result), firstError, runId]
    );

    if (logger) {
      logger.info(`[workflow] Run ${runId} completed with status: ${finalStatus}`);
    }

    return {
      id: runId,
      workflow_id: workflow.id,
      status: finalStatus,
      action_results: actionResults,
      error: firstError,
      completed_at: new Date(),
    };
  } catch (err) {
    // Critical error — mark run as failed and log
    if (logger) logger.error(`[workflow] Run ${runId} failed with critical error: ${err.message}`);

    try {
      await pool.query(
        `UPDATE workflow_runs SET status = 'failed', error = $1, completed_at = NOW() WHERE id = $2`,
        [err.message, runId]
      );
    } catch (dbErr) {
      // Silently fail if we can't update the run record
      console.error('[workflow] Failed to update run record:', dbErr.message);
    }

    throw err;
  }
}

module.exports = {
  runWorkflow,
};
