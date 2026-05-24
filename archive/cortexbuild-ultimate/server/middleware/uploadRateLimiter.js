/**
 * Stricter rate limiter for file upload endpoints
 * Uploads are expensive operations (I/O, storage, processing)
 * Limit: 20 requests per minute per user
 */
const rateLimits = new Map();

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 20; // Stricter limit for uploads

function redisUrl() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  const host = process.env.REDIS_HOST || "127.0.0.1";
  const port = process.env.REDIS_PORT || "6379";
  return `redis://${host}:${port}`;
}

let redisClient = null;
const REDIS_ENABLED = process.env.REDIS_URL || process.env.REDIS_HOST;

if (REDIS_ENABLED) {
  try {
    const Redis = require("redis");
    redisClient = Redis.createClient({ url: redisUrl() });
    redisClient.on("error", (err) => {
      console.error(
        "[Redis] Upload rate limiter connection error:",
        err.message,
      );
    });
    redisClient.connect().catch((err) => {
      console.error(
        "[Redis] Upload rate limiter connection failed:",
        err.message,
      );
    });
  } catch (e) {
    console.warn(
      "[Redis] Upload rate limiter skipped (redis package missing):",
      e?.message || e,
    );
    redisClient = null;
  }
}

function getClientKey(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : "anonymous";
  return `rate_limit_upload:${token}:${req.path.replace(/\//g, "_")}`;
}

function cleanExpired(map) {
  const now = Date.now();
  for (const [key, record] of map.entries()) {
    if (record.resetAt <= now) map.delete(key);
  }
}

module.exports = function uploadRateLimiter(req, res, next) {
  const key = getClientKey(req);

  if (redisClient && redisClient.isOpen) {
    return redisClient
      .incr(key)
      .then(async (count) => {
        if (count === 1) {
          await redisClient.pExpire(key, WINDOW_MS).catch((err) => {
            console.error("[UploadRateLimiter] pExpire failed:", err.message);
          });
        }
        if (count > MAX_REQUESTS) {
          const ttl = await redisClient.pTTL(key).catch((err) => {
            console.error("[UploadRateLimiter] pTTL failed:", err.message);
            return WINDOW_MS;
          });
          const retryAfter = Math.ceil(ttl / 1000);
          res.set("Retry-After", retryAfter);
          return res.status(429).json({
            message: "Too many upload requests. Please try again later.",
            retryAfter,
          });
        }
        next();
      })
      .catch((err) => {
        console.error("[UploadRateLimiter] Redis error:", err.message);
        fallbackRateLimiter(req, res, next);
      });
  }

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
      message: "Too many upload requests. Please try again later.",
      retryAfter,
    });
  }

  record.count++;
  next();
}
