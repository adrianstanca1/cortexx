/**
 * Token Blacklist for JWT Logout
 * Stores revoked token IDs (jti) in Redis with TTL matching token expiry
 */
const redis = require("redis");
const pool = require("../db");

// Redis client for token blacklist
const redisClient = redis.createClient({
  url:
    process.env.REDIS_URL ||
    `redis://${process.env.REDIS_HOST || "localhost"}:6379`,
});

redisClient.on("error", (err) =>
  console.error("[Redis] Token blacklist error:", err.message),
);
redisClient.connect().catch((err) => {
  console.error("[Redis] Token blacklist connection failed:", err.message);
});

/**
 * Add a token to the blacklist
 * @param {string} jti - JWT ID
 * @param {number} expiresIn - Seconds until token expires
 */
async function blacklistToken(jti, expiresIn) {
  if (!jti) return;
  try {
    await redisClient.setEx(`blacklist:${jti}`, expiresIn, "1");
    console.log(`[Auth] Token ${jti.slice(0, 8)}... blacklisted`);
  } catch (err) {
    console.error("[Auth] Failed to blacklist token:", err.message);
  }
}

/**
 * Check if a token is blacklisted
 * @param {string} jti - JWT ID
 * @returns {Promise<boolean>}
 */
async function isTokenBlacklisted(jti) {
  if (!jti) return false;
  try {
    const result = await redisClient.get(`blacklist:${jti}`);
    return result === "1";
  } catch (err) {
    console.error("[Auth] Failed to check blacklist:", err.message);
    // Production: fail closed (treat as revoked) unless explicitly opted out.
    if (
      process.env.NODE_ENV === "production" &&
      process.env.TOKEN_BLACKLIST_FAIL_OPEN !== "true"
    ) {
      return true;
    }
    return false;
  }
}

/**
 * Store refresh token in database (for token rotation)
 */
async function storeRefreshToken(userId, tokenHash, expiresAt) {
  try {
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET token_hash = $2, expires_at = $3`,
      [userId, tokenHash, expiresAt],
    );
  } catch (err) {
    console.error("[Auth] Failed to store refresh token:", err.message);
  }
}

/**
 * Revoke all refresh tokens for a user
 */
async function revokeAllUserTokens(userId) {
  try {
    await pool.query("DELETE FROM refresh_tokens WHERE user_id = $1", [userId]);
  } catch (err) {
    console.error("[Auth] Failed to revoke tokens:", err.message);
  }
}

module.exports = {
  blacklistToken,
  isTokenBlacklisted,
  storeRefreshToken,
  revokeAllUserTokens,
};
