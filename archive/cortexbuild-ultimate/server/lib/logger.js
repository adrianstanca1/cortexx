/**
 * Lightweight structured JSON logger — zero-dependency alternative to pino.
 * Writes newline-delimited JSON (NDJSON) to stdout/stderr.
 * Compatible with pino destinations if upgraded later.
 * Redacts secrets from extra fields and URLs in messages.
 */

const LOG_LEVEL = (process.env.LOG_LEVEL || "info").toLowerCase();
const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 };
const CURRENT = LEVELS[LOG_LEVEL] ?? 30;

const SENSITIVE_KEYS = new Set([
  "password", "secret", "token", "api_key", "apikey", "auth", "credential",
  "private_key", "jwt", "session_secret", "db_password", "redis_password",
  "ollama_api_key", "sendgrid_api_key", "stripe_secret", "webhook_secret",
]);

function isSensitiveKey(key) {
  if (typeof key !== "string") return false;
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.has(lower) || SENSITIVE_KEYS.has(lower.replace(/[_-]/g, "")) || /(pass|secret|token|key|credential|auth|private)/i.test(lower);
}

function redactValue(value) {
  if (typeof value === "string") {
    // Redact URLs with embedded credentials
    return value.replace(/(\w+:\/\/[^:@\s]+:)([^@\s]+)(@)/g, "$1***$3");
  }
  return value;
}

function redactExtra(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (isSensitiveKey(k)) {
      out[k] = "[REDACTED]";
    } else if (v && typeof v === "object") {
      out[k] = redactExtra(v);
    } else {
      out[k] = redactValue(v);
    }
  }
  return out;
}

function log(level, msg, extra = {}) {
  if ((LEVELS[level] ?? 30) < CURRENT) return;
  const safeMsg = typeof msg === "string" ? redactValue(msg) : msg;
  const entry = {
    level,
    time: Date.now(),
    msg: safeMsg,
    pid: process.pid,
    hostname: require("os").hostname(),
    ...redactExtra(extra),
  };
  const out = level === "error" || level === "fatal" ? process.stderr : process.stdout;
  out.write(JSON.stringify(entry) + "\n");
}

const logger = {
  trace: (msg, extra) => log("trace", msg, extra),
  debug: (msg, extra) => log("debug", msg, extra),
  info: (msg, extra) => log("info", msg, extra),
  warn: (msg, extra) => log("warn", msg, extra),
  error: (msg, extra) => log("error", msg, extra),
  fatal: (msg, extra) => log("fatal", msg, extra),
};

module.exports = logger;
