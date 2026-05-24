/**
 * server/lib/workflow/dispatcher.js
 * Dispatch events to workflows
 */

const { runWorkflow } = require('./runner');

/**
 * Dispatch an event to all matching workflows for an organization
 * Runs matching workflows in parallel, but each workflow executes its actions sequentially
 *
 * @param {string} eventType - Event type (e.g. "autoimprove.suggestion.executed")
 * @param {Object} payload - Event payload
 * @param {Object} ctx - Context { pool, logger, user, organizationId }
 * @returns {Promise<Array>} Array of workflow run results
 */
async function dispatch(eventType, payload, ctx = {}) {
  const { pool, logger, user, organizationId } = ctx;

  if (!pool || !organizationId) {
    console.warn('[dispatcher] Missing pool or organizationId');
    return [];
  }

  try {
    // Load all enabled workflows for this organization with matching trigger event
    const { rows: workflows } = await pool.query(
      `SELECT id, name, trigger, conditions, actions
       FROM workflows
       WHERE organization_id = $1
         AND enabled = true
         AND trigger->>'event' = $2`,
      [organizationId, eventType]
    );

    if (!workflows.length) {
      if (logger) logger.debug(`[dispatcher] No workflows for event ${eventType}`);
      return [];
    }

    if (logger) {
      logger.info(
        `[dispatcher] Dispatching event ${eventType} to ${workflows.length} workflow(s)`
      );
    }

    // Run all workflows in parallel
    const runPromises = workflows.map((workflow) => {
      // Parse JSON fields if they're strings
      const wf = {
        ...workflow,
        trigger: typeof workflow.trigger === 'string' ? JSON.parse(workflow.trigger) : workflow.trigger,
        conditions: typeof workflow.conditions === 'string' ? JSON.parse(workflow.conditions) : workflow.conditions,
        actions: typeof workflow.actions === 'string' ? JSON.parse(workflow.actions) : workflow.actions,
      };

      return runWorkflow(wf, payload, { pool, logger, user })
        .catch((err) => {
          // Log but don't throw — one failed workflow shouldn't crash the dispatcher
          if (logger) {
            logger.error(`[dispatcher] Workflow ${workflow.id} failed: ${err.message}`);
          } else {
            console.error(`[dispatcher] Workflow ${workflow.id} failed:`, err);
          }
          return null;
        });
    });

    const results = await Promise.all(runPromises);
    return results.filter((r) => r != null);
  } catch (err) {
    if (logger) {
      logger.error(`[dispatcher] Critical error dispatching event ${eventType}: ${err.message}`);
    } else {
      console.error('[dispatcher] Error:', err);
    }
    return [];
  }
}

module.exports = {
  dispatch,
};
