/**
 * server/lib/workflow/action-registry.js
 * Registry of workflow action handlers
 * Each handler is async, takes (action, context, deps), returns { ok, result? | error? }
 */

const fetch = require('node-fetch');

/**
 * Action handler: create_change_order
 * Calls existing change order creation logic
 * @param {Object} action - { type: 'create_change_order', params: {...} }
 * @param {Object} context - { event, user, workflow }
 * @param {Object} deps - { pool, logger }
 * @returns {Promise<{ ok: boolean, result?: Object, error?: string }>}
 */
async function handleCreateChangeOrder(action, context, deps) {
  const { params } = action;
  const { pool, logger } = deps;

  try {
    const { rows } = await pool.query(
      `INSERT INTO change_orders (
        project_id, description, reason, requested_by, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW())
      RETURNING id, project_id, description, status`,
      [
        params.project_id,
        params.description || 'Auto-generated from workflow',
        params.reason,
        context.user?.id || null,
      ]
    );

    if (logger) logger.info(`[workflow] Created change order ${rows[0].id}`);

    return {
      ok: true,
      result: {
        change_order_id: rows[0].id,
        project_id: rows[0].project_id,
        status: rows[0].status,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: `Failed to create change order: ${err.message}`,
    };
  }
}

/**
 * Action handler: send_notification
 * Calls existing notification logic
 * @param {Object} action - { type: 'send_notification', params: { type, user_id, title, body } }
 * @param {Object} context
 * @param {Object} deps - { pool, logger }
 */
async function handleSendNotification(action, context, deps) {
  const { params } = action;
  const { pool, logger } = deps;

  try {
    const { rows } = await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, read, created_at)
       VALUES ($1, $2, $3, $4, false, NOW())
       RETURNING id`,
      [params.user_id, params.type || 'workflow', params.title, params.body]
    );

    if (logger) logger.info(`[workflow] Sent notification ${rows[0].id}`);

    return {
      ok: true,
      result: { notification_id: rows[0].id },
    };
  } catch (err) {
    return {
      ok: false,
      error: `Failed to send notification: ${err.message}`,
    };
  }
}

/**
 * Action handler: webhook
 * POST to a URL with signed payload
 * @param {Object} action - { type: 'webhook', params: { url, headers?, body } }
 * @param {Object} context
 * @param {Object} deps - { logger }
 */
async function handleWebhook(action, context, deps) {
  const { params } = action;
  const { logger } = deps;

  try {
    const url = params.url;
    if (!url) {
      return { ok: false, error: 'Webhook URL is required' };
    }

    const body = params.body || context;
    const headers = {
      'Content-Type': 'application/json',
      ...(params.headers || {}),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      timeout: 5000,
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Webhook returned ${response.status}: ${response.statusText}`,
      };
    }

    const result = await response.json().catch(() => ({}));

    if (logger) logger.info(`[workflow] Webhook POST to ${url} succeeded`);

    return {
      ok: true,
      result: { webhook_status: response.status, webhook_response: result },
    };
  } catch (err) {
    return {
      ok: false,
      error: `Webhook failed: ${err.message}`,
    };
  }
}

/**
 * Action handler: noop
 * No-op action for testing
 */
async function handleNoop(action, context, deps) {
  return {
    ok: true,
    result: { message: 'No-op action executed' },
  };
}

/**
 * Registry mapping action type to handler function
 */
const handlers = {
  create_change_order: handleCreateChangeOrder,
  send_notification: handleSendNotification,
  webhook: handleWebhook,
  noop: handleNoop,
};

/**
 * Get action handler by type
 * @param {string} type - Action type
 * @returns {Function|null} Handler function or null if not found
 */
function getHandler(type) {
  return handlers[type] || null;
}

/**
 * Register a custom action handler
 * @param {string} type - Action type
 * @param {Function} handler - Async handler function
 */
function registerHandler(type, handler) {
  if (typeof handler !== 'function') {
    throw new Error(`Handler for action type "${type}" must be a function`);
  }
  handlers[type] = handler;
}

module.exports = {
  getHandler,
  registerHandler,
  handlers,
  handleCreateChangeOrder,
  handleSendNotification,
  handleWebhook,
  handleNoop,
};
