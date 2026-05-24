/**
 * CortexBuild Ultimate — Notifications API
 * Store and manage notifications in the database
 * Multi-tenant: all queries scoped to organization_id
 */
const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { createNotification, createAlert, broadcast } = require('../lib/websocket');
const { buildTenantFilter, isSuperAdmin } = require('../middleware/tenantFilter');
const createPushRouter = require('./push');
const pushRouter = createPushRouter();

const router = express.Router();
router.use(authMiddleware);

// Get notifications for user (user's own + org-wide broadcasts)
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { page = '1', pageSize = '50', status, type, severity, category, projectId } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    let whereClauses = [];
    const tenantFilter = buildTenantFilter(req, 'AND', null, 2);
    let params = [userId, ...tenantFilter.params];
    let idx = 2 + tenantFilter.params.length;

    // Filter: own notifications OR org-wide (user_id IS NULL)
    // Use COALESCE so company_owner (with null organization_id) can see their company's notifications
    // For super_admin, show all notifications; for others, scope by tenant
    if (isSuperAdmin(req)) {
      whereClauses.push(`(user_id = $1 OR user_id IS NULL)`);
      params = [userId];
      idx = 2;
    } else {
      whereClauses.push(`(user_id = $1 OR (COALESCE(organization_id, company_id) = $2 AND user_id IS NULL))`);
    }

    if (status) {
      whereClauses.push(`status = $${idx++}`);
      params.push(status);
    }
    if (type) {
      whereClauses.push(`type = $${idx++}`);
      params.push(type);
    }
    if (severity) {
      whereClauses.push(`severity = $${idx++}`);
      params.push(severity);
    }
    if (projectId) {
      // Escape special LIKE characters to prevent broad matching
      const escaped = projectId.replace(/[%_\\]/g, '\\$&');
      whereClauses.push(`link LIKE $${idx++}`);
      params.push(`%${escaped}%`);
    }

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT * FROM notifications ${where}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      [...params, parseInt(pageSize), offset]
    );

    const { rows: [{ count: total }] } = await pool.query(
      `SELECT COUNT(*) FROM notifications ${where}`, params
    );

    // Unread count uses only the base user/org filter — not status/type/severity filters
    let unreadQuery, unreadParams;
    if (isSuperAdmin(req)) {
      unreadQuery = `SELECT COUNT(*) FROM notifications WHERE (user_id = $1 OR user_id IS NULL) AND read = false`;
      unreadParams = [userId];
    } else {
      const unreadFilter = buildTenantFilter(req, 'AND', null, 2);
      unreadQuery = `SELECT COUNT(*) FROM notifications WHERE (user_id = $1 OR (COALESCE(organization_id, company_id) = $2 AND user_id IS NULL)) AND read = false`;
      unreadParams = [userId, ...unreadFilter.params];
    }
    const { rows: [{ count: unread }] } = await pool.query(unreadQuery, unreadParams);

    res.json({ notifications: rows, total: parseInt(total, 10), unreadCount: parseInt(unread, 10) });
  } catch (err) {
    console.error('[GET /notifications]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get unread count
router.get('/unread-count', async (req, res) => {
  try {
    const userId = req.user?.id;
    let query, params;
    if (isSuperAdmin(req)) {
      query = `SELECT COUNT(*) as count FROM notifications
        WHERE (user_id = $1 OR user_id IS NULL)
          AND read = false
          AND (snoozed_until IS NULL OR snoozed_until < NOW())`;
      params = [userId];
    } else {
      const filter = buildTenantFilter(req, 'AND', null, 2);
      query = `SELECT COUNT(*) as count FROM notifications
        WHERE (user_id = $1 OR (COALESCE(organization_id, company_id) = $2 AND user_id IS NULL))
          AND read = false
          AND (snoozed_until IS NULL OR snoozed_until < NOW())`;
      params = [userId, ...filter.params];
    }
    const { rows } = await pool.query(query, params);
    res.json({ unreadCount: parseInt(rows[0].count, 10) });
  } catch (err) {
    console.error('[GET /notifications/unread-count]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get notification settings for current user
router.get('/settings', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { rows } = await pool.query(
      `SELECT * FROM notification_settings WHERE user_id = $1`,
      [userId]
    );
    if (!rows[0]) {
      return res.json({
        soundAlerts: true,
        browserNotifications: false,
        quietHours: { enabled: false, start: '22:00', end: '08:00' },
        categoryPreferences: {}
      });
    }
    res.json({
      soundAlerts: rows[0].sound_alerts,
      browserNotifications: rows[0].browser_notif,
      quietHours: {
        enabled: rows[0].quiet_hours_enabled,
        start: rows[0].quiet_hours_start,
        end: rows[0].quiet_hours_end,
      },
      categoryPreferences: {}
    });
  } catch (err) {
    console.error('[GET /notifications/settings]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update notification settings
router.put('/settings', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { soundAlerts, browserNotifications, quietHours, categoryPreferences } = req.body;

    const existing = await pool.query(
      `SELECT id FROM notification_settings WHERE user_id = $1 AND category = 'all'`,
      [userId]
    );

    if (existing.rows[0]) {
      await pool.query(
        `UPDATE notification_settings SET
           sound_alerts = COALESCE($1, sound_alerts),
           browser_notif = COALESCE($2, browser_notif),
           quiet_hours_enabled = COALESCE($3, quiet_hours_enabled),
           quiet_hours_start = COALESCE($4, quiet_hours_start),
           quiet_hours_end = COALESCE($5, quiet_hours_end),
           updated_at = NOW()
         WHERE user_id = $6 AND category = 'all'`,
        [
          soundAlerts ?? null,
          browserNotifications ?? null,
          quietHours?.enabled ?? null,
          quietHours?.start ?? null,
          quietHours?.end ?? null,
          userId
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO notification_settings (user_id, sound_alerts, browser_notif, quiet_hours_enabled, quiet_hours_start, quiet_hours_end)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          soundAlerts ?? true,
          browserNotifications ?? false,
          quietHours?.enabled ?? false,
          quietHours?.start ?? '22:00',
          quietHours?.end ?? '08:00'
        ]
      );
    }
    res.json({ message: 'Settings updated' });
  } catch (err) {
    console.error('[PUT /notifications/settings]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get notification history (archived)
router.get('/history', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { page = '1', pageSize = '50' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const tenantFilter = buildTenantFilter(req, 'AND', null, 2);

    const { rows } = await pool.query(
      `SELECT * FROM notifications
       WHERE (user_id = $1 OR (COALESCE(organization_id, company_id) = $2 AND user_id IS NULL))
         AND status = 'archived'
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, ...tenantFilter.params, parseInt(pageSize), offset]
    );

    res.json({ notifications: rows, total: rows.length });
  } catch (err) {
    console.error('[GET /notifications/history]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Mark notification as read (must belong to this user/org)
router.put('/:id/read', async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantFilter = buildTenantFilter(req, 'AND', null, 3);
    const { rows } = await pool.query(
      `UPDATE notifications SET read = true, status = 'read'
       WHERE id = $1 AND (user_id = $2 OR (COALESCE(organization_id, company_id) = $3 AND user_id IS NULL))
       RETURNING *`,
      [req.params.id, userId, ...tenantFilter.params]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Notification not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PUT /notifications/:id/read]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Mark all as read
router.put('/read-all', async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantFilter = buildTenantFilter(req, 'AND', null, 2);
    await pool.query(
      `UPDATE notifications SET read = true, status = 'read'
       WHERE (user_id = $1 OR (COALESCE(organization_id, company_id) = $2 AND user_id IS NULL))
         AND read = false`,
      [userId, ...tenantFilter.params]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('[PUT /notifications/read-all]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /mark-all-read - for consistency with frontend expectations
router.post('/mark-all-read', async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantFilter = buildTenantFilter(req, 'AND', null, 2);
    await pool.query(
      `UPDATE notifications SET read = true, status = 'read'
       WHERE (user_id = $1 OR (COALESCE(organization_id, company_id) = $2 AND user_id IS NULL))
         AND read = false`,
      [userId, ...tenantFilter.params]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('[POST /notifications/mark-all-read]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Bulk mark as read
router.post('/mark-read-bulk', async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantFilter = buildTenantFilter(req, 'AND', null, 3);
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: 'ids array is required' });
    }
    await pool.query(
      `UPDATE notifications SET read = true, status = 'read'
       WHERE id = ANY($1) AND (user_id = $2 OR (COALESCE(organization_id, company_id) = $3 AND user_id IS NULL))`,
      [ids, userId, ...tenantFilter.params]
    );
    res.json({ message: 'Notifications marked as read' });
  } catch (err) {
    console.error('[POST /notifications/mark-read-bulk]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Archive a notification
router.put('/:id/archive', async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantFilter = buildTenantFilter(req, 'AND', null, 3);
    const { rows } = await pool.query(
      `UPDATE notifications SET status = 'archived', archived_at = NOW()
       WHERE id = $1 AND (user_id = $2 OR (COALESCE(organization_id, company_id) = $3 AND user_id IS NULL))
       RETURNING *`,
      [req.params.id, userId, ...tenantFilter.params]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Notification not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PUT /notifications/:id/archive]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Archive all read notifications
router.post('/archive-read', async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantFilter = buildTenantFilter(req, 'AND', null, 2);
    await pool.query(
      `UPDATE notifications SET status = 'archived', archived_at = NOW()
       WHERE (user_id = $1 OR (COALESCE(organization_id, company_id) = $2 AND user_id IS NULL))
         AND status = 'read'`,
      [userId, ...tenantFilter.params]
    );
    res.json({ message: 'Read notifications archived' });
  } catch (err) {
    console.error('[POST /notifications/archive-read]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Snooze a notification
router.put('/:id/snooze', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { until } = req.body;
    if (!until) return res.status(400).json({ message: 'until timestamp is required' });
    const tenantFilter = buildTenantFilter(req, 'AND', null, 4);
    const { rows } = await pool.query(
      `UPDATE notifications SET status = 'snoozed', snoozed_until = $1
       WHERE id = $2 AND (user_id = $3 OR (COALESCE(organization_id, company_id) = $4 AND user_id IS NULL))
       RETURNING *`,
      [until, req.params.id, userId, ...tenantFilter.params]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Notification not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PUT /notifications/:id/snooze]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Unsnooze a notification
router.put('/:id/unsnooze', async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantFilter = buildTenantFilter(req, 'AND', null, 3);
    const { rows } = await pool.query(
      `UPDATE notifications SET status = 'unread', snoozed_until = NULL
       WHERE id = $1 AND (user_id = $2 OR (COALESCE(organization_id, company_id) = $3 AND user_id IS NULL))
       RETURNING *`,
      [req.params.id, userId, ...tenantFilter.params]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Notification not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PUT /notifications/:id/unsnooze]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Clear all notifications for this user (personal only — preserves org broadcasts)
router.delete('/all', async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantFilter = buildTenantFilter(req, 'AND', null, 2);
    const { rows } = await pool.query(
      `DELETE FROM notifications WHERE user_id = $1 AND COALESCE(organization_id, company_id) = $2 RETURNING id`,
      [userId, ...tenantFilter.params]
    );
    res.json({ message: 'All notifications cleared', count: rows.length });
  } catch (err) {
    console.error('[DELETE /notifications/all]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete individual notification
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantFilter = buildTenantFilter(req, 'AND', null, 3);
    const { rowCount } = await pool.query(
      `DELETE FROM notifications
       WHERE id = $1 AND (user_id = $2 OR (COALESCE(organization_id, company_id) = $3 AND user_id IS NULL))`,
      [req.params.id, userId, ...tenantFilter.params]
    );
    if (!rowCount) return res.status(404).json({ message: 'Notification not found' });
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    console.error('[DELETE /notifications/:id]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Bulk delete notifications
router.post('/delete-bulk', async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantFilter = buildTenantFilter(req, 'AND', null, 3);
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: 'ids array is required' });
    }
    const { rows } = await pool.query(
      `DELETE FROM notifications
       WHERE id = ANY($1) AND (user_id = $2 OR (COALESCE(organization_id, company_id) = $3 AND user_id IS NULL))
       RETURNING id`,
      [ids, userId, ...tenantFilter.params]
    );
    res.json({ message: 'Notifications deleted', count: rows.length });
  } catch (err) {
    console.error('[POST /notifications/delete-bulk]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Export notifications
router.post('/export', async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantFilter = buildTenantFilter(req, 'AND', null, 2);
    const { format = 'json' } = req.body;
    const { rows } = await pool.query(
      `SELECT * FROM notifications
       WHERE (user_id = $1 OR (COALESCE(organization_id, company_id) = $2 AND user_id IS NULL))
       ORDER BY created_at DESC`,
      [userId, ...tenantFilter.params]
    );
    if (format === 'csv') {
      const headers = Object.keys(rows[0] || {}).join(',');
      const lines = rows.map(r => Object.values(r).join(','));
      res.setHeader('Content-Type', 'text/csv');
      return res.send([headers, ...lines].join('\n'));
    }
    res.json({ notifications: rows, total: rows.length });
  } catch (err) {
    console.error('[POST /notifications/export]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create notification (for system use — requires admin role)
router.post('/', async (req, res) => {
  try {
    const { title, description, severity, type, user_id, link } = req.body;
    const orgId = req.user?.organization_id;
    const companyId = req.user?.company_id;

    const { rows } = await pool.query(
      `INSERT INTO notifications (title, description, severity, type, user_id, link, organization_id, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, description, severity || 'info', type || 'notification', user_id || null, link || null, orgId, companyId]
    );

    const notification = rows[0];

    // Broadcast to all connected clients in this org
    broadcast({
      type: 'notification',
      payload: { title, description, severity: severity || 'info', link: link || null, timestamp: new Date().toISOString() }
    });

    // Send push notification to user if user_id is specified
    if (user_id) {
      pushRouter.sendPushToUser(user_id, {
        title: title || 'Notification',
        body: description || '',
        data: { link: link || null, notificationId: notification.id },
        badge: 1,
      });
    }

    res.json(notification);
  } catch (err) {
    console.error('[POST /notifications]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Generate system notifications (periodic checks — admin only)
router.post('/generate-alerts', async (req, res) => {
  try {
    const orgId = req.user?.organization_id;
    const companyId = req.user?.company_id;
    const alerts = [];

    // Check for overdue invoices
    const { rows: overdueInvoices } = await pool.query(
      `SELECT COUNT(*) as count FROM invoices WHERE status = 'overdue' AND COALESCE(organization_id, company_id) = $1`,
      [orgId || companyId]
    );
    if (parseInt(overdueInvoices[0].count, 10) > 0) {
      alerts.push({
        title: 'Overdue Invoices',
        description: `${overdueInvoices[0].count} invoice(s) are overdue`,
        severity: 'warning',
        type: 'alert',
        link: '/invoicing'
      });
    }

    // Check for expiring RAMS (within 30 days)
    const { rows: expiringRams } = await pool.query(
      `SELECT COUNT(*) as count FROM rams WHERE review_date < NOW() + INTERVAL '30 days' AND review_date > NOW() AND COALESCE(organization_id, company_id) = $1`,
      [orgId || companyId]
    );
    if (parseInt(expiringRams[0].count, 10) > 0) {
      alerts.push({
        title: 'RAMS Expiring Soon',
        description: `${expiringRams[0].count} RAMS document(s) expiring within 30 days`,
        severity: 'warning',
        type: 'alert',
        link: '/rams'
      });
    }

    // Check for open safety incidents
    const { rows: openIncidents } = await pool.query(
      `SELECT COUNT(*) as count FROM safety_incidents WHERE status IN ('open', 'investigating') AND COALESCE(organization_id, company_id) = $1`,
      [orgId || companyId]
    );
    if (parseInt(openIncidents[0].count, 10) > 0) {
      alerts.push({
        title: 'Open Safety Incidents',
        description: `${openIncidents[0].count} safety incident(s) require attention`,
        severity: 'critical',
        type: 'alert',
        link: '/safety'
      });
    }

    // Save and broadcast alerts
    if (alerts.length > 0) {
      const titles = alerts.map(a => a.title);
      const descriptions = alerts.map(a => a.description);
      const severities = alerts.map(a => a.severity);
      const types = alerts.map(a => a.type);
      const links = alerts.map(a => a.link);
      const now = new Date().toISOString();

      await pool.query(
        `INSERT INTO notifications (title, description, severity, type, link, organization_id, company_id)
         SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::uuid[], $7::uuid[])`,
        [
          titles,
          descriptions,
          severities,
          types,
          links,
          Array(alerts.length).fill(orgId || null),
          Array(alerts.length).fill(companyId || null)
        ]
      );

      for (const alert of alerts) {
        broadcast({
          type: 'alert',
          payload: { ...alert, timestamp: now }
        });
      }
    }

    res.json({ generated: alerts.length, alerts });
  } catch (err) {
    console.error('[POST /notifications/generate-alerts]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
