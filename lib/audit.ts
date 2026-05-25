/**
 * Audit log helpers. Distinct from `Activity` — activity is user-facing
 * (timelines, feeds); audit events are immutable forensic records for
 * compliance and security investigations.
 *
 * Fire-and-forget: every helper swallows its own errors so an audit failure
 * never breaks the user request.
 */
import { Prisma } from '@prisma/client'
import { prisma } from './db'
import { getCurrentOrg } from './tenancy'

export interface AuditPayload {
  /** Optional. When omitted, falls back to the active org on the AsyncLocalStorage
   *  context (set by requireAuth → setOrgContext). Skip the DB write when
   *  neither is available rather than persisting a half-populated row. */
  organizationId?: string
  userId?: string | null
  action: string                 // dot-notation: "project.delete", "invoice.paid", etc.
  resourceType: string
  resourceId: string
  metadata?: Prisma.InputJsonValue
  ipAddress?: string | null
  userAgent?: string | null
}

export function auditLog(payload: AuditPayload): void {
  const organizationId = payload.organizationId || getCurrentOrg()?.organizationId
  if (!organizationId) {
    // No org context — log to stderr but don't persist. Routes that fire
    // outside any tenant scope (e.g. 2FA enable/disable for an org-less
    // user) hit this path; the action still lives in the process log.
    console.info('[audit] no org context — skipped DB write', payload.action, payload.resourceType, payload.resourceId)
    return
  }
  prisma.auditEvent.create({
    data: {
      organizationId,
      userId: payload.userId || getCurrentOrg()?.userId || null,
      action: payload.action,
      resourceType: payload.resourceType,
      resourceId: payload.resourceId,
      metadata: payload.metadata,
      ipAddress: payload.ipAddress || null,
      userAgent: payload.userAgent || null,
    },
  }).catch((err: unknown) => {
    // Last-resort logging: an audit failure must not break the user request.
    console.error('[audit] failed to record event', payload.action, err)
  })
}

/** Convenience: extract IP + UA from a Next request. */
export function requestMeta(req: Request): { ipAddress: string | null; userAgent: string | null } {
  const ipAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    null
  const userAgent = req.headers.get('user-agent')?.slice(0, 280) || null
  return { ipAddress, userAgent }
}
