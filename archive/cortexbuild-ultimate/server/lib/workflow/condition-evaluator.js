/**
 * server/lib/workflow/condition-evaluator.js
 * Pure function for evaluating workflow conditions against context
 */

/**
 * Resolve a dot-path against context. Returns a tuple so callers can tell
 * "path is missing entirely" apart from "path resolved to undefined/null",
 * which matters for `exists` and for surfacing misconfigured workflows.
 *
 * @param {Object} context
 * @param {string} path - Dot notation (e.g. "event.amount")
 * @returns {{ value: *, found: boolean }}
 */
function resolvePath(context, path) {
  const parts = path.split('.');
  let current = context;
  for (const part of parts) {
    if (current == null || !Object.prototype.hasOwnProperty.call(current, part)) {
      return { value: undefined, found: false };
    }
    current = current[part];
  }
  return { value: current, found: true };
}

/**
 * Backwards-compatible accessor — just returns the resolved value (or undefined).
 */
function getValueAtPath(context, path) {
  return resolvePath(context, path).value;
}

/**
 * Evaluate a single condition against context
 * @param {Object} condition - { operator, path, value }
 * @param {Object} context - Context object for evaluation
 * @returns {boolean}
 */
function evaluateCondition(condition, context) {
  const { operator, path, value } = condition;
  const { value: contextValue, found } = resolvePath(context, path);

  // Surface misconfigured paths once per evaluation so workflow authors can
  // diagnose silent false-negatives. `exists` legitimately probes for absence,
  // so don't warn there.
  if (!found && operator !== 'exists') {
    console.warn(
      `[condition-evaluator] Path not found in context: "${path}" (operator=${operator})`,
    );
  }

  switch (operator) {
    case 'eq':
      return contextValue === value;
    case 'neq':
      return contextValue !== value;
    case 'gt':
      return contextValue > value;
    case 'lt':
      return contextValue < value;
    case 'gte':
      return contextValue >= value;
    case 'lte':
      return contextValue <= value;
    case 'in':
      // value should be an array
      return Array.isArray(value) && value.includes(contextValue);
    case 'contains':
      // contextValue should be a string or array, value is substring or element
      if (typeof contextValue === 'string') {
        return contextValue.includes(String(value));
      }
      if (Array.isArray(contextValue)) {
        return contextValue.includes(value);
      }
      return false;
    case 'exists':
      // value is ignored; tests if path exists and is not null/undefined
      return contextValue !== null && contextValue !== undefined;
    default:
      console.warn(`[condition-evaluator] Unknown operator: ${operator}`);
      return false;
  }
}

/**
 * Recursively evaluate a condition group or array of conditions
 * @param {Array|Object} conditions - Array of conditions or ConditionGroup with mode + conditions
 * @param {Object} context
 * @param {string} mode - 'all' (AND) or 'any' (OR) — default 'all'
 * @returns {boolean}
 */
function evaluateConditionGroup(conditions, context, mode = 'all') {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return true; // No conditions = pass
  }

  if (mode === 'all') {
    return conditions.every((cond) => {
      // If this is a nested group with mode property
      if (cond.mode && cond.conditions) {
        return evaluateConditionGroup(cond.conditions, context, cond.mode);
      }
      return evaluateCondition(cond, context);
    });
  }

  if (mode === 'any') {
    return conditions.some((cond) => {
      if (cond.mode && cond.conditions) {
        return evaluateConditionGroup(cond.conditions, context, cond.mode);
      }
      return evaluateCondition(cond, context);
    });
  }

  return true;
}

/**
 * Evaluate workflow conditions against a context object
 * Top-level conditions array defaults to 'all' (AND) logic
 *
 * @param {Array<Object>|Object} conditions - Array of conditions, or { mode, conditions }
 * @param {Object} context - Context object (e.g. { event: {...}, user: {...} })
 * @returns {boolean} True if conditions pass, false otherwise
 *
 * @example
 * const conditions = [
 *   { operator: 'eq', path: 'event.type', value: 'change_order.suggested' },
 *   { operator: 'gt', path: 'event.amount', value: 1000 }
 * ];
 * const context = { event: { type: 'change_order.suggested', amount: 2000 } };
 * evaluateConditions(conditions, context); // true
 */
function evaluateConditions(conditions, context) {
  if (!conditions) return true;

  // If conditions is an object with mode property, use that
  if (conditions.mode && conditions.conditions) {
    return evaluateConditionGroup(conditions.conditions, context, conditions.mode);
  }

  // Otherwise treat as array with default 'all' mode
  if (Array.isArray(conditions)) {
    return evaluateConditionGroup(conditions, context, 'all');
  }

  // Not an array or group object — pass
  return true;
}

module.exports = {
  evaluateConditions,
  evaluateCondition,
  evaluateConditionGroup,
  getValueAtPath,
  resolvePath,
};
