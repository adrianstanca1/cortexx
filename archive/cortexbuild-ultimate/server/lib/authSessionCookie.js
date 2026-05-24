const crypto = require('crypto');
const pool = require('../db');

/** Cookie SameSite: default lax (OAuth returns + same-site /api fetches). Set AUTH_TOKEN_COOKIE_SAMESITE=strict to harden (know your OAuth flows). */
const AUTH_TOKEN_COOKIE_SAMESITE = process.env.AUTH_TOKEN_COOKIE_SAMESITE || 'lax';

function setAuthTokenCookie(res, token, maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: AUTH_TOKEN_COOKIE_SAMESITE,
    maxAge: maxAgeMs,
    path: '/',
  };
  if (process.env.AUTH_TOKEN_COOKIE_DOMAIN) {
    opts.domain = process.env.AUTH_TOKEN_COOKIE_DOMAIN;
  }
  res.cookie('token', token, opts);
}

async function createUserSession(userId, token, req) {
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const deviceInfo = req.headers['user-agent'] || 'Unknown';
    const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown';
    await pool.query(
      'INSERT INTO user_sessions (user_id, token_hash, device_info, ip_address) VALUES ($1, $2, $3, $4)',
      [userId, tokenHash, deviceInfo, ipAddress]
    );
  } catch (err) {
    console.error('[createUserSession]', err.message);
  }
}

module.exports = { setAuthTokenCookie, createUserSession };
