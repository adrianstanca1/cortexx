/**
 * CortexBuild Ultimate — Notifications Router Index
 * Composes all notification sub-routes and re-exports existing notifications API
 */
const express = require('express');
const router = express.Router();

// Re-export existing notifications API for backwards compatibility
router.use('/', require('./notifications'));

// Sub-routes
router.use('/email', require('./email-notifications'));
router.use('/slack', require('./slack'));
router.use('/preferences', require('./preferences'));

// Push subscription endpoint
const pool = require('../../db');
const authMiddleware = require('../../middleware/auth');

router.post('/push-subscribe', authMiddleware, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    const userId = req.user?.id;
    if (!endpoint || !keys) {
      return res.status(400).json({ message: 'endpoint and keys are required' });
    }
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, endpoint)
       DO UPDATE SET p256dh = $3, auth = $4, updated_at = NOW()`,
      [userId, endpoint, keys.p256dh, keys.auth]
    );
    res.json({ message: 'Push subscription saved' });
  } catch (err) {
    console.error('[POST /notifications/push-subscribe]', err.message);
    res.status(500).json({ message: 'Failed to save subscription' });
  }
});

router.post('/push-unsubscribe', authMiddleware, async (req, res) => {
  try {
    const { endpoint } = req.body;
    const userId = req.user?.id;
    await pool.query(
      `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
      [userId, endpoint]
    );
    res.json({ message: 'Push subscription removed' });
  } catch (err) {
    console.error('[POST /notifications/push-unsubscribe]', err.message);
    res.status(500).json({ message: 'Failed to remove subscription' });
  }
});

router.post('/push-receive', authMiddleware, async (req, res) => {
  try {
    const { endpoint, payload } = req.body;
    const userId = req.user?.id;
    const { rows } = await pool.query(
      `SELECT * FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
      [userId, endpoint]
    );
    if (!rows[0]) {
      return res.status(404).json({ message: 'Subscription not found' });
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[POST /notifications/push-receive]', err.message);
    res.status(500).json({ message: 'Failed to process push' });
  }
});

module.exports = router;