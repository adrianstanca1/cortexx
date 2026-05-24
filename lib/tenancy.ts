/**
 * Request-scoped organization context + Prisma extension that auto-injects
 * the org filter into every owned-model query.
 *
 * Flow:
 *   1. requireOrg() resolves the active org and calls runWithOrg(orgId, fn)
 *   2. Inside fn, the Prisma client extension reads the AsyncLocalStorage
 *      value and adds `organizationId` to where/data clauses for owned
 *      models
 *
 * Until MULTITENANT_ENFORCED is true in production, the extension is a
 * no-op (returns the query unchanged) so routes that aren't yet
 * codemodded continue to work.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { Prisma } from '@prisma/client'
import { MULTITENANT_ENFORCED } from './org'

interface OrgRequestContext {
  organizationId: string | null
  userId: string | null
  role: string | null
}

const storage = new AsyncLocalStorage<OrgRequestContext>()

/** Set up the org context for the duration of `fn`. Returns whatever fn returns. */
export function runWithOrg<T>(ctx: OrgRequestContext, fn: () => Promise<T> | T): Promise<T> | T {
  return storage.run(ctx, fn)
}

/**
 * Set the org context for the rest of the current async context. Use this
 * at the top of a route handler after `requireOrg()` resolves — every
 * Prisma call further down the call stack will inherit the context.
 *
 * Each Next.js request gets its own async context, so contexts don't leak
 * between concurrent requests.
 */
export function setOrgContext(ctx: OrgRequestContext): void {
  storage.enterWith(ctx)
}

/** Read the org context for the current request (or null outside any). */
export function getCurrentOrg(): OrgRequestContext | null {
  return storage.getStore() || null
}

// ─── Owned-model registry ────────────────────────────────────────────
// Mirror of the models that have an organizationId column. Kept here
// instead of introspecting Prisma metadata so it's deterministic and
// reviewable.
const OWNED_MODELS = new Set<string>([
  'Project', 'Task', 'TeamMember', 'Assignment', 'Invoice', 'TimeEntry',
  'Activity', 'Comment', 'Document', 'Snag', 'Certification', 'Rfi',
  'Announcement', 'Observation', 'Variation', 'Lead', 'Customer', 'Quote',
  'SiteCheckIn', 'MileageEntry', 'CostItem', 'Subcontractor', 'Equipment',
  'Material', 'PurchaseOrder', 'SubInvoice', 'Drawing', 'DrawingRevision',
  'Milestone', 'Permit', 'Rams', 'Tender', 'Inspection', 'Meeting', 'Risk',
  'ToolboxTalk', 'MaintenanceSchedule', 'Supplier', 'SafetyIncident',
])

/**
 * Returns the Prisma client extension that auto-scopes owned-model queries
 * to the current request's organization. Attach with prisma.$extends(...).
 *
 * Gated by MULTITENANT_ENFORCED — until the flag is set, the extension
 * passes queries through unchanged. This is the safe rollout path: ship
 * the extension, watch logs, flip the flag in a follow-up deploy once
 * routes have been verified.
 */
export const tenancyExtension = Prisma.defineExtension({
  name: 'org-scope',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!MULTITENANT_ENFORCED) return query(args)
        if (!model || !OWNED_MODELS.has(model)) return query(args)

        const ctx = storage.getStore()
        const orgId = ctx?.organizationId
        if (!orgId) {
          // No org context — pass through. Background jobs, cron, and the
          // tenant-management routes themselves end up here.
          return query(args)
        }

        // Read-shaped operations: add to where.
        if (
          operation === 'findFirst' ||
          operation === 'findFirstOrThrow' ||
          operation === 'findMany' ||
          operation === 'findUnique' ||
          operation === 'findUniqueOrThrow' ||
          operation === 'count' ||
          operation === 'aggregate' ||
          operation === 'groupBy' ||
          operation === 'updateMany' ||
          operation === 'deleteMany'
        ) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const a = args as any
          a.where = { ...(a.where || {}), organizationId: orgId }
          return query(a)
        }

        // Create / createMany: add to data
        if (operation === 'create' || operation === 'createMany') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const a = args as any
          if (Array.isArray(a.data)) {
            a.data = a.data.map((d: Record<string, unknown>) => ({ ...d, organizationId: orgId }))
          } else if (a.data) {
            a.data = { ...a.data, organizationId: orgId }
          }
          return query(a)
        }

        // upsert: filter the where AND scope create/update data
        if (operation === 'upsert') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const a = args as any
          a.where = { ...(a.where || {}), organizationId: orgId }
          if (a.create) a.create = { ...a.create, organizationId: orgId }
          return query(a)
        }

        // update / delete (single, by id): scope via where
        if (operation === 'update' || operation === 'delete') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const a = args as any
          a.where = { ...(a.where || {}), organizationId: orgId }
          return query(a)
        }

        return query(args)
      },
    },
  },
})

/** True when the auto-scope extension would currently affect queries. */
export function isTenancyActive(): boolean {
  return MULTITENANT_ENFORCED && !!storage.getStore()?.organizationId
}
