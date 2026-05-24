/**
 * Push Notification Routes
 * Manages device token registration, removal, and debugging
 * Integrates with APNs (iOS), FCM (Android, TODO), and VAPID (web, TODO)
 *
 * Factory pattern for dependency injection (enables testability)
 */

const express = require('express');
const webpush = require('web-push');

/**
 * Factory function to create the push router with injected dependencies
 * @param {Object} options Configuration object
 * @param {Object} options.db PostgreSQL pool (defaults to require('../db'))
 * @param {Function} options.authMiddleware Auth middleware (defaults to require('../middleware/auth'))
 * @param {Object} options.dispatcher Dispatcher with sendPushToUser (defaults to require('../lib/push/dispatcher')())
 * @returns {express.Router} Configured router
 */
function createPushRouter(options = {}) {
  const db = options.db || require('../db');
  const authMiddleware = options.authMiddleware || require('../middleware/auth');
  const dispatcher = options.dispatcher || require('../lib/push/dispatcher')();

  const router = express.Router();

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@cortexbuildpro.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// In-memory store for legacy web-push subscriptions (deprecated)
const subscriptions = new Map(); // userId → PushSubscription

// POST /api/push/register (auth) — register a device token (iOS, Android, web)
router.post('/register', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { deviceToken, platform, bundleId, environment } = req.body;

    if (!deviceToken || !platform) {
      return res.status(400).json({ error: 'deviceToken and platform required' });
    }

    if (!['ios', 'android', 'web'].includes(platform)) {
      return res.status(400).json({ error: 'platform must be ios|android|web' });
    }

    // Validate APNs token format (64 hex chars) for iOS
    if (platform === 'ios') {
      const APNS_TOKEN_RE = /^[0-9a-f]{64}$/i;
      if (!APNS_TOKEN_RE.test(deviceToken)) {
        return res.status(400).json({ error: 'Invalid APNs token format' });
      }
    }

    // Upsert: insert or update if exists
    const { rows } = await db.query(
      `INSERT INTO push_tokens (user_id, platform, device_token, bundle_id, environment)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, device_token) DO UPDATE
       SET last_seen_at = NOW(), environment = EXCLUDED.environment, bundle_id = EXCLUDED.bundle_id
       RETURNING *`,
      [userId, platform, deviceToken, bundleId || null, environment || 'production']
    );

    console.log(`[Push] Token registered: platform=${platform}, user=${userId}`);
    res.status(201).json({ ok: true, token: rows[0] });
  } catch (err) {
    console.error('[POST /api/push/register]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/push/register (auth) — unregister a device token (e.g., on logout)
router.delete('/register', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { deviceToken } = req.body;
    if (!deviceToken) {
      return res.status(400).json({ error: 'deviceToken required' });
    }

    const { rowCount } = await db.query(
      `DELETE FROM push_tokens WHERE user_id = $1 AND device_token = $2`,
      [userId, deviceToken]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }

    console.log(`[Push] Token unregistered: user=${userId}`);
    res.status(200).json({ ok: true, removed: rowCount });
  } catch (err) {
    console.error('[DELETE /api/push/register]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/push/tokens (auth) — list current user's registered tokens (debugging)
router.get('/tokens', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { rows } = await db.query(
      `SELECT id, platform, bundle_id, environment, last_seen_at, created_at
       FROM push_tokens
       WHERE user_id = $1
       ORDER BY platform, created_at DESC`,
      [userId]
    );

    res.json({ tokens: rows });
  } catch (err) {
    console.error('[GET /api/push/tokens]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/push/vapid-public-key — return VAPID public key for web client
router.get('/vapid-public-key', (_req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || '' });
});

// Legacy: POST /api/push/subscribe — store client web-push subscription
// Kept for backward compatibility with existing web-push clients
router.post('/subscribe', (req, res) => {
  const { subscription } = req.body;
  if (!subscription?.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }
  const userId = req.user?.id || 'anonymous';
  subscriptions.set(userId, subscription);
  res.json({ ok: true });
});

  // Internal helper export — send push to user (non-blocking)
  // Used by other routes to trigger push notifications
  router.sendPushToUser = async (userId, payload) => {
    // Fire-and-forget: catch errors locally so push failures don't break upstream
    setImmediate(() => {
      dispatcher.sendPushToUser(userId, payload).catch((err) => {
        console.error(`[Push] Uncaught error in sendPushToUser: ${err.message}`);
      });
    });
  };

  // Internal helper export — broadcast push to all users
  // TODO: implement efficient broadcast query
  router.broadcastPush = async (payload) => {
    console.debug('[Push] Broadcast not yet implemented');
  };

  return router;
}

module.exports = createPushRouter;
