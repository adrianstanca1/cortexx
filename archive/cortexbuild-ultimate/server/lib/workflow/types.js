/**
 * server/lib/workflow/types.js
 * Type definitions and JSDoc typedefs for workflow engine
 */

/**
 * @typedef {Object} Trigger
 * @property {string} type - Event type ("event" currently supported)
 * @property {string} event - Event name (e.g. "autoimprove.suggestion.executed", "change_order.suggested")
 */

/**
 * @typedef {Object} Condition
 * @property {string} operator - Logical operator ("eq", "neq", "gt", "lt", "gte", "lte", "in", "contains", "exists")
 * @property {string} path - Dot-notation path to context value (e.g. "event.amount", "event.type")
 * @property {*} value - Expected value or comparison operand
 */

/**
 * @typedef {Object} ConditionGroup
 * @property {string} mode - How to combine conditions ("all", "any")
 * @property {Array<Condition|ConditionGroup>} conditions - Nested conditions
 */

/**
 * @typedef {Object} Action
 * @property {string} type - Action handler type ("create_change_order", "send_notification", "webhook", "noop")
 * @property {Object} params - Action-specific parameters
 * @property {boolean} [continueOnError] - If true, workflow continues on action failure (default: false)
 */

/**
 * @typedef {Object} WorkflowRun
 * @property {string} id - UUID
 * @property {string} workflow_id - Foreign key to workflows.id
 * @property {Object} trigger_event - Original trigger payload
 * @property {string} status - "pending" | "running" | "succeeded" | "failed" | "skipped"
 * @property {Object} [result] - Action results if succeeded
 * @property {string} [error] - Error message if failed
 * @property {Date} started_at
 * @property {Date} [completed_at]
 */

/**
 * @typedef {Object} ActionResult
 * @property {boolean} ok - Whether action succeeded
 * @property {*} [result] - Action-specific result data
 * @property {string} [error] - Error message if ok=false
 */

/**
 * @typedef {Object} WorkflowRunResult
 * @property {string} id - workflow_runs.id
 * @property {string} workflow_id
 * @property {string} status
 * @property {Array<ActionResult>} action_results
 * @property {string} [error] - First failure message if status=failed
 * @property {Date} completed_at
 */

module.exports = {
  // Re-export typedefs for documentation (values are null, types exist in JSDoc)
  Trigger: null,
  Condition: null,
  ConditionGroup: null,
  Action: null,
  WorkflowRun: null,
  ActionResult: null,
  WorkflowRunResult: null,
};
