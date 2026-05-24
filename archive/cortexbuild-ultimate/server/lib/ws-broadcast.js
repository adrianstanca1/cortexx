/**
 * CortexBuild Ultimate — WebSocket Broadcast Helper
 * Server-side utility to push real-time events to connected clients.
 * Import this from any route that modifies dashboard-relevant data.
 */
const { broadcast, sendToRoom } = require('./websocket');

const MESSAGE_TYPES = {
  NOTIFICATION: 'notification',
  DASHBOARD_UPDATE: 'dashboard_update',
  ALERT: 'alert',
  COLLABORATION: 'collaboration',
  SYSTEM: 'system',
};

// Tables that affect dashboard KPI widgets
const DASHBOARD_TABLES = new Set([
  'projects',
  'invoices',
  'safety_incidents',
  'rfis',
  'team_members',
  'daily_reports',
  'change_orders',
  'measurements',
  'signage',
]);

// Maps table name → which KPI key(s) it affects
const TABLE_TO_KPI = {
  projects:           ['activeProjects', 'totalRevenue'],
  invoices:           ['outstanding', 'totalRevenue'],
  safety_incidents:   ['hsScore', 'openRfis'],
  rfis:               ['openRfis'],
  team_members:       ['workforce'],
  daily_reports:      ['workforce'],
  change_orders:      ['totalRevenue'],
  measurements:       ['totalRevenue', 'activeProjects'],
  signage:            ['activeProjects'],
};

/**
 * Broadcast a dashboard_update to all connected clients.
 * Call this after any INSERT/UPDATE/DELETE on a dashboard-relevant table.
 *
 * @param {string} action - 'create' | 'update' | 'delete'
 * @param {string} table - DB table name
 * @param {object} record - The affected row (for context)
 */
function broadcastDashboardUpdate(action, table, record) {
  if (!DASHBOARD_TABLES.has(table)) return;

  const affectedKpis = TABLE_TO_KPI[table] || [];

  broadcast({
    type: MESSAGE_TYPES.DASHBOARD_UPDATE,
    event: `${action}_${table}`,
    payload: {
      action,
      table,
      record,
      affectedKpis,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Broadcast a real-time notification to all connected clients.
 * Use for user-facing alerts (new project created, safety incident, etc.)
 *
 * @param {string} title
 * @param {string} description
 * @param {'info'|'success'|'warning'|'error'|'critical'} severity
 * @param {object} data - Extra context (project name, etc.)
 */
function broadcastNotification(title, description, severity = 'info', data = {}) {
  broadcast({
    type: MESSAGE_TYPES.NOTIFICATION,
    event: 'notification',
    payload: {
      title,
      description,
      severity,
      ...data,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Broadcast a critical alert.
 */
function broadcastAlert(title, description, data = {}) {
  broadcast({
    type: MESSAGE_TYPES.ALERT,
    event: 'alert',
    payload: {
      title,
      description,
      severity: 'critical',
      ...data,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Broadcast to a specific project room.
 * Call this when a project-scoped event occurs.
 */
function broadcastProjectUpdate(projectId, action, table, record) {
  const room = `project:${projectId}`;
  sendToRoom(room, {
    type: MESSAGE_TYPES.COLLABORATION,
    event: `${action}_${table}`,
    payload: {
      projectId,
      action,
      table,
      record,
      timestamp: new Date().toISOString(),
    },
  });
}

module.exports = {
  broadcastDashboardUpdate,
  broadcastNotification,
  broadcastAlert,
  broadcastProjectUpdate,
  MESSAGE_TYPES,
  DASHBOARD_TABLES,
};
