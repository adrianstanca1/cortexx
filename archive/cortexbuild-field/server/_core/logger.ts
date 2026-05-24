/**
 * Centralized server-side logger with credential redaction.
 *
 * Why: today nothing in `server/` uses morgan or pino, but if a contributor
 * adds request-body logging via console.log(req.body), credentials in the
 * body (PIN, password, token, p8 contents) leak to PM2 stdout. This module
 * is the only sanctioned path for server logging — paired with an ESLint
 * rule that warns on raw `console.*` calls in `server/`.
 *
 * Design:
 *   - Object args walked recursively; keys matching the credential regex
 *     get their value replaced with "[REDACTED]".
 *   - Cyclic references handled (WeakSet).
 *   - Very long (>200 char) strings get a length-only stub even if the
 *     enclosing key isn't named credentially — backstop against keys we
 *     forgot to add to the regex.
 *   - Errors preserved with .message and .stack so debug context stays.
 */

const CREDENTIAL_KEY = /pin|password|secret|token|p8|key|jwt|cookie|auth/i;
const LONG_STRING_THRESHOLD = 200;
const REDACTED = "[REDACTED]";

export function redactForLog(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === "number" || t === "boolean" || t === "bigint" || t === "symbol") return value;
  if (t === "string") {
    if ((value as string).length > LONG_STRING_THRESHOLD) {
      return `[redacted-long-string len=${(value as string).length}]`;
    }
    return value;
  }
  if (t !== "object") return String(value);

  if (seen.has(value as object)) return "[cycle]";
  seen.add(value as object);

  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactForLog(item, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (CREDENTIAL_KEY.test(k)) {
      out[k] = REDACTED;
    } else {
      out[k] = redactForLog(v, seen);
    }
  }
  return out;
}

function format(level: string, args: unknown[]): string {
  const ts = new Date().toISOString();
  const redacted = args.map((a) => redactForLog(a));
  const parts = redacted.map((a) => {
    if (typeof a === "string") return a;
    try {
      return JSON.stringify(a);
    } catch {
      return String(a);
    }
  });
  return `${ts} [${level}] ${parts.join(" ")}\n`;
}

export const log = {
  info(...args: unknown[]): void {
    process.stdout.write(format("info", args));
  },
  warn(...args: unknown[]): void {
    process.stderr.write(format("warn", args));
  },
  error(...args: unknown[]): void {
    process.stderr.write(format("error", args));
  },
  debug(...args: unknown[]): void {
    if (process.env.LOG_DEBUG === "1") {
      process.stdout.write(format("debug", args));
    }
  },
};
