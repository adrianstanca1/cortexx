/**
 * Push Notification Dispatcher
 * Routes notifications to appropriate platform handlers (iOS/APNs, Android/FCM, web/VAPID)
 * Manages token lifecycle: updates last_seen_at, removes invalid tokens
 *
 * Factory pattern for dependency injection (enables testability)
 */

/**
 * Factory function to create a dispatcher with injected dependencies
 * @param {Object} options Configuration object
 * @param {Object} options.db PostgreSQL pool (defaults to require('../../db'))
 * @param {Object} options.apns APNs client wrapper (defaults to require('./apns-client'))
 * @returns {Object} Dispatcher object with sendPushToUser method
 */
function createDispatcher(options = {}) {
  const db = options.db || require('../../db');
  const apnsClient = options.apns || require('./apns-client');

  /**
   * Send push to a user across all registered devices
   * @param {string} userId - User ID
   * @param {object} payload - { title, body, data, badge }
   */
  async function sendPushToUser(userId, payload) {
    if (!userId) {
      console.warn('[Push] sendPushToUser called without userId');
      return;
    }

    // No push backend wired up at all? Skip the DB roundtrip and exit silently.
    // (apns-client warns once on first call so operators see a single hint.)
    if (!apnsClient.isApnsConfigured()) {
      return;
    }

    try {
      // Fetch all active tokens for this user
      const { rows: tokens } = await db.query(
        `SELECT id, platform, device_token, environment FROM push_tokens
         WHERE user_id = $1 AND last_seen_at > NOW() - INTERVAL '90 days'
         ORDER BY platform`,
        [userId]
      );

      if (tokens.length === 0) {
        console.debug(`[Push] No active tokens for user ${userId}`);
        return;
      }

      // Fan out to platform-specific handlers
      for (const token of tokens) {
        try {
          if (token.platform === 'ios') {
            await sendToIos(token, payload);
          } else if (token.platform === 'android') {
            // TODO: Android FCM support
            console.debug(`[Push] Android FCM not yet implemented for token ${token.id}`);
          } else if (token.platform === 'web') {
            // TODO: Web VAPID support
            console.debug(`[Push] Web VAPID not yet implemented for token ${token.id}`);
          }

          // Update last_seen_at on successful send
          await db.query(
            `UPDATE push_tokens SET last_seen_at = NOW() WHERE id = $1`,
            [token.id]
          );
        } catch (err) {
          console.error(`[Push] Error sending to token ${token.id}:`, err.message);
        }
      }
    } catch (err) {
      console.error(`[Push] sendPushToUser error for user ${userId}:`, err.message);
    }
  }

  /**
   * Send notification via APNs (iOS)
   * Removes token if APNs reports BadDeviceToken or Unregistered
   */
  async function sendToIos(token, payload) {
    const result = await apnsClient.sendApnsNotification(token.device_token, payload);

    if (!result.ok) {
      // Check if token is invalid
      if (
        result.reason === 'BadDeviceToken' ||
        result.reason === 'Unregistered' ||
        result.reason === 'InvalidProviderToken'
      ) {
        console.info(`[Push] Removing invalid iOS token: ${result.reason}`);
        await db.query(`DELETE FROM push_tokens WHERE id = $1`, [token.id]);
      } else {
        console.warn(`[Push] APNs send failed (${result.reason}): ${result.error || ''}`);
      }
    } else {
      console.debug(`[Push] APNs sent to token ${token.id}`);
    }
  }

  return {
    sendPushToUser,
  };
}

module.exports = createDispatcher;
