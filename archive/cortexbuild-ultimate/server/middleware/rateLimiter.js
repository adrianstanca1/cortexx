const rateLimits = new Map(); // Fallback for non-Redis environments

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 100;

function redisUrl() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  const host = process.env.REDIS_HOST || "127.0.0.1";
  const port = process.env.REDIS_PORT || "6379";
  return `redis://${host}:${port}`;
}

// Redis client for cluster-safe rate limiting (optional: lives in server/package.json only)
let redisClient = null;
const REDIS_ENABLED = process.env.REDIS_URL || process.env.REDIS_HOST;

if (REDIS_ENABLED) {
  try {
    const Redis = require("redis");
    redisClient = Redis.createClient({ url: redisUrl() });
    redisClient.on("error", (err) => {
      console.error("[Redis] Rate limiter connection error:", err.message);
    });
    redisClient.connect().catch((err) => {
      console.error("[Redis] Rate limiter connection failed:", err.message);
    });
  } catch (e) {
    console.warn(
      "[Redis] Rate limiter skipped (redis package missing):",
      e?.message || e,
    );
    redisClient = null;
  }
}

function getClientKey(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token) return `rate_limit:token:${token}:${req.path.replace(/\//g, "_")}`;
  // Unauthenticated: use real client IP (set by nginx as X-Real-IP)
  const ip = req.headers["x-real-ip"] || req.socket.remoteAddress || "unknown";
  return `rate_limit:ip:${ip}:${req.path.replace(/\//g, "_")}`;
}

function cleanExpired(map) {
  const now = Date.now();
  for (const [key, record] of map.entries()) {
    if (record.resetAt <= now) map.delete(key);
  }
}

/** High-frequency or monitoring paths — do not count toward global IP limits. */
function shouldSkipGlobalRateLimit(req) {
  const p = req.path || "";
  if (p === "/api/health") return true;
  if (p === "/api/agent-debug") return true;
  if (p.startsWith("/api/metrics")) return true;
  return false;
}

module.exports = function rateLimiter(req, res, next) {
  if (shouldSkipGlobalRateLimit(req)) {
    return next();
  }

  const key = getClientKey(req);
  const now = Date.now();

  // Redis-backed rate limiting (cluster-safe)
  if (redisClient && redisClient.isOpen) {
    return redisClient
      .incr(key)
      .then((count) => {
        if (count === 1) {
          // First request - set expiry
          redisClient.pExpire(key, WINDOW_MS);
        }
        if (count > MAX_REQUESTS) {
          redisClient.pTTL(key).then((ttl) => {
            const retryAfter = Math.ceil(ttl / 1000);
            res.set("Retry-After", retryAfter);
            res.status(429).json({
              message: "Too many requests. Please try again later.",
              retryAfter,
            });
          });
        } else {
          next();
        }
      })
      .catch(() => {
        // Redis failed — in production, fail closed (deny requests) since
        // in-memory fallback is insecure in multi-instance deployments.
        if (process.env.NODE_ENV === "production") {
          return res.status(503).json({
            message:
              "Service temporarily unavailable. Rate limiting service error.",
          });
        }
        // Dev/staging: fall back to in-memory (single-instance only)
        fallbackRateLimiter(req, res, next);
      });
  }

  // Fallback to in-memory (single-instance only)
  fallbackRateLimiter(req, res, next);
};

function fallbackRateLimiter(req, res, next) {
  cleanExpired(rateLimits);
  const key = getClientKey(req);
  const now = Date.now();
  const record = rateLimits.get(key);

  if (!record || record.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  if (record.count >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    res.set("Retry-After", retryAfter);
    return res.status(429).json({
      message: "Too many requests. Please try again later.",
      retryAfter,
    });
  }

  record.count++;
  next();
}

module.exports.RATE_LIMITER_MAX = MAX_REQUESTS;
module.exports.RATE_LIMITER_WINDOW_MS = WINDOW_MS;
