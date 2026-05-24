/*
 * Request Logger Middleware
 * Logs request method, path, duration, status, and user
 * Enhanced with slow request detection and error tracking
 */

const SLOW_THRESHOLD_MS = 1000;
const VERY_SLOW_THRESHOLD_MS = 5000;

function requestLogger(req, res, next) {
  const start = Date.now();
  const method = req.method;
  const path = req.originalUrl || req.url;
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;

  // Track response
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;

    // Log all requests
    const logEntry = {
      timestamp: new Date().toISOString(),
      method,
      path,
      status,
      duration: `${duration}ms`,
      ip,
      user: req.user?.id || 'anonymous',
    };

    if (status >= 500) {
      console.error('❌ SERVER ERROR:', JSON.stringify(logEntry));
    } else if (duration > VERY_SLOW_THRESHOLD_MS) {
      console.warn('🐌 VERY SLOW:', JSON.stringify(logEntry));
    } else if (duration > SLOW_THRESHOLD_MS) {
      console.warn('⚠️  SLOW:', JSON.stringify(logEntry));
    } else if (process.env.NODE_ENV !== 'production') {
      console.log(`${method} ${path} ${status} ${duration}ms`);
    }
  });

  next();
}

module.exports = requestLogger;
