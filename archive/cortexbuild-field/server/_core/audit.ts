/**
 * Audit log writer — Phase 2.5 of docs/ROADMAP.md.
 *
 * One row per administrative-class mutation. Captures:
 *   companyId, userId, action (procedure path), entityType+entityId,
 *   ip, userAgent, redacted input + result, error code/message on failure.
 *
 * Best-effort & non-blocking: the audit write should NEVER throw into the
 * caller. Failure to write an audit row must not 500 the user's mutation.
 * Failures are logged via the redacting `log.error` so ops can spot drift
 * without leaking the credentials we just redacted from the audit row.
 */
import type { Request } from "express";
import { getDb } from "../db";
import { auditLog as dbAuditLog } from "../../drizzle/schema";
import { redactForLog, log } from "./logger";

export interface AuditEvent {
  companyId: number;
  userId: number | null;
  action: string;
  entityType?: string | null;
  entityId?: number | null;
  req?: Pick<Request, "headers" | "ip" | "socket"> | null;
  input?: unknown;
  result?: unknown;
  errorCode?: string | null;
  errorMessage?: string | null;
}

function clientIp(req: AuditEvent["req"]): string | null {
  if (!req) return null;
  const xf = req.headers?.["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) return xf.split(",")[0]?.trim() ?? null;
  if (Array.isArray(xf) && xf[0]) return String(xf[0]).split(",")[0]?.trim() ?? null;
  if (typeof req.ip === "string" && req.ip) return req.ip;
  const ra = req.socket?.remoteAddress;
  return typeof ra === "string" && ra ? ra : null;
}

function userAgent(req: AuditEvent["req"]): string | null {
  if (!req) return null;
  const ua = req.headers?.["user-agent"];
  return typeof ua === "string" ? ua.slice(0, 500) : null;
}

const MAX_JSON_BYTES = 8 * 1024; // truncate large payloads to 8 KB

function safeJson(value: unknown): string | null {
  if (value === undefined) return null;
  try {
    const redacted = redactForLog(value);
    const s = JSON.stringify(redacted);
    if (s == null) return null;
    return s.length > MAX_JSON_BYTES
      ? s.slice(0, MAX_JSON_BYTES - 24) + `..."[truncated:${s.length}]"`
      : s;
  } catch {
    return '"[unserializable]"';
  }
}

/**
 * Write one audit row. Never throws — DB unavailability or serialisation
 * errors are logged but otherwise swallowed. Returns true on success.
 */
export async function writeAuditLog(event: AuditEvent): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) {
      log.warn("[audit] db unavailable; skipping audit row", { action: event.action });
      return false;
    }
    await db.insert(dbAuditLog).values({
      companyId: event.companyId,
      userId: event.userId ?? null,
      action: event.action,
      entityType: event.entityType ?? null,
      entityId: event.entityId ?? null,
      ip: clientIp(event.req ?? null),
      userAgent: userAgent(event.req ?? null),
      inputJson: safeJson(event.input),
      resultJson: safeJson(event.result),
      errorCode: event.errorCode ?? null,
      errorMessage: event.errorMessage ?? null,
    });
    return true;
  } catch (err) {
    log.error("[audit] write failed", err);
    return false;
  }
}
