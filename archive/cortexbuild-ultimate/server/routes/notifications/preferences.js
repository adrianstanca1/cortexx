/**
 * CortexBuild Ultimate — Notification Preferences API
 * Get/Update user notification preferences
 */
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const authMiddleware = require('../../middleware/auth');
const { buildTenantFilter } = require('../../middleware/tenantFilter');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { rows } = await pool.query(
      `SELECT * FROM notification_preferences WHERE user_id = $1`,
      [userId]
    );
    if (!rows[0]) {
      return res.json({
        email_on: true,
        push_on: true,
        slack_on: false,
        types: {
          invoice: true,
          safety: true,
          rfi: true,
          project: true,
          team: true,
        },
      });
    }
    res.json({
      email_on: rows[0].email_on,
      push_on: rows[0].push_on,
      slack_on: rows[0].slack_on,
      types: rows[0].notification_types || {
        invoice: true,
        safety: true,
        rfi: true,
        project: true,
        team: true,
      },
    });
  } catch (err) {
    console.error('[GET /notifications/preferences]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { email_on, push_on, slack_on, types } = req.body;

    const existing = await pool.query(
      `SELECT id FROM notification_preferences WHERE user_id = $1`,
      [userId]
    );

    if (existing.rows[0]) {
      await pool.query(
        `UPDATE notification_preferences SET
           email_on = COALESCE($1, email_on),
           push_on = COALESCE($2, push_on),
           slack_on = COALESCE($3, slack_on),
           notification_types = COALESCE($4, notification_types),
           updated_at = NOW()
         WHERE user_id = $5`,
        [
          email_on ?? null,
          push_on ?? null,
          slack_on ?? null,
          types ? JSON.stringify(types) : null,
          userId,
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO notification_preferences (user_id, email_on, push_on, slack_on, notification_types)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          email_on ?? true,
          push_on ?? true,
          slack_on ?? false,
          types ? JSON.stringify(types) : JSON.stringify({
            invoice: true,
            safety: true,
            rfi: true,
            project: true,
            team: true,
          }),
        ]
      );
    }
    res.json({ message: 'Preferences updated' });
  } catch (err) {
    console.error('[PUT /notifications/preferences]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

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
    console.error('[POST /notifications/preferences/mark-all-read]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;