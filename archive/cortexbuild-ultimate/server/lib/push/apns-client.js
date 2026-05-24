/**
 * APNs Client (Apple Push Notification Service)
 * Lazy-initialized singleton for sending iOS push notifications via @parse/node-apn
 * Requires: APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_PATH or APNS_KEY_CONTENTS,
 *           APNS_BUNDLE_ID, optional APNS_PRODUCTION (default true)
 */

const apn = require('@parse/node-apn');
let provider = null;
let warnedNotConfigured = false;

/**
 * Lightweight check that the APNs env is fully configured. Used to short-circuit
 * before any I/O so unconfigured deployments don't flood logs with errors.
 */
function isApnsConfigured() {
  return Boolean(
    process.env.APNS_KEY_ID &&
    process.env.APNS_TEAM_ID &&
    process.env.APNS_BUNDLE_ID &&
    (process.env.APNS_KEY_PATH || process.env.APNS_KEY_CONTENTS)
  );
}

function getApnsProvider() {
  if (provider) return provider;

  // Validate required environment variables
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const bundleId = process.env.APNS_BUNDLE_ID;
  const keyPath = process.env.APNS_KEY_PATH;
  const keyContents = process.env.APNS_KEY_CONTENTS;
  const isProduction = process.env.APNS_PRODUCTION !== 'false';

  if (!keyId || !teamId || !bundleId) {
    throw new Error(
      'APNs not configured. Required env vars: APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID'
    );
  }

  if (!keyPath && !keyContents) {
    throw new Error(
      'APNs not configured. Provide either APNS_KEY_PATH or APNS_KEY_CONTENTS (base64)'
    );
  }

  let key;
  if (keyPath) {
    const fs = require('fs');
    key = fs.readFileSync(keyPath, 'utf8');
  } else if (keyContents) {
    key = Buffer.from(keyContents, 'base64').toString('utf8');
  }

  provider = new apn.Provider({
    token: {
      key,
      keyId,
      teamId,
    },
    production: isProduction,
  });

  console.log(`[APNs] Provider initialized (production: ${isProduction}, bundleId: ${bundleId})`);
  return provider;
}

async function sendApnsNotification(token, payload) {
  // Defensive short-circuit: callers should ideally check isApnsConfigured()
  // first, but if APNs isn't set up at all we want to no-op cleanly rather
  // than spam errors per push attempt.
  if (!isApnsConfigured()) {
    if (!warnedNotConfigured) {
      console.warn('[APNs] Not configured — push send is a no-op. Set APNS_* env vars to enable.');
      warnedNotConfigured = true;
    }
    return { ok: false, reason: 'NotConfigured', error: 'APNs env not set' };
  }
  try {
    const prov = getApnsProvider();
    const notification = new apn.Notification({
      alert: {
        title: payload.title || 'Notification',
        body: payload.body || '',
      },
      badge: payload.badge || 1,
      sound: 'default',
      contentAvailable: true,
      mutableContent: true,
      topic: process.env.APNS_BUNDLE_ID,
      payload: payload.data || {},
    });

    const result = await prov.send(notification, token);

    // Check for failures
    if (result.failed && result.failed.length > 0) {
      const failure = result.failed[0];
      return {
        ok: false,
        reason: failure.reason,
        response: failure,
      };
    }

    return {
      ok: true,
      response: result,
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'Send failed',
      error: err.message,
    };
  }
}

module.exports = {
  getApnsProvider,
  sendApnsNotification,
  isApnsConfigured,
};
