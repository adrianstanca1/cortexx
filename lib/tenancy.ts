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
  /** When true, the Prisma tenancy extension skips org-scope injection.
   *  Use only for cron, webhook receivers, and tenant-management routes
   *  via the bypassTenancy() helper. */
  bypass?: boolean
}

const storage = new AsyncLocalStorage<OrgRequestContext>()

/** Set up the org context for the duration of `fn`. Returns whatever fn returns.
 *
 *  IMPORTANT: the inner await happens INSIDE the storage.run scope so
 *  async work (e.g. `() => prisma.project.findMany()`) sees the context
 *  when the Prisma extension fires. Without this wrapper, the PrismaPromise
 *  is returned synchronously, storage.run exits, and the lazy query lookup
 *  loses the context. Discovered while writing the cross-org integration
 *  suite — caused every subtest to throw "called without org context".
 */
export function runWithOrg<T>(ctx: OrgRequestContext, fn: () => Promise<T> | T): Promise<T> {
  return storage.run(ctx, async () => await fn())
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
/**
 * Routes / background jobs that LEGITIMATELY operate without an org
 * context (cron sweeps, tenant-management routes themselves, the
 * webhook receiver). They opt out of fail-closed scoping for the
 * current async scope. Use sparingly.
 */
export function bypassTenancy<T>(fn: () => Promise<T> | T): Promise<T> {
  // Same await-inside-the-scope trick as runWithOrg — keeps the bypass
  // context active while a PrismaPromise inside fn resolves.
  return storage.run(
    { organizationId: null, userId: null, role: null, bypass: true },
    async () => await fn(),
  )
}

export const tenancyExtension = Prisma.defineExtension({
  name: 'org-scope',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!MULTITENANT_ENFORCED) return query(args)
        if (!model || !OWNED_MODELS.has(model)) return query(args)

        const ctx = storage.getStore()
        if (ctx?.bypass) return query(args)

        const orgId = ctx?.organizationId
        if (!orgId) {
          // Fail closed: a query against an owned model without org context
          // is almost always a bug (forgot requireOrg) or an attack vector.
          // Bypass legitimately via bypassTenancy() wrapper.
          throw new Error(
            `[tenancy] ${model}.${operation} called without org context. ` +
              `Wrap with bypassTenancy() if this is intentional (cron / system task).`,
          )
        }

        // Clone args at every branch — never mutate the caller's object,
        // since it may be a shared template reused across calls. Prisma's
        // generated args types are model-specific unions, so query()
        // accepts different shapes per model; casting through `any` keeps
        // the single $allOperations handler usable across all 39 owned
        // models. Project's eslint config doesn't enforce no-explicit-any,
        // so no directive needed.
        const aIn = args as any

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
          return query({ ...aIn, where: { ...(aIn.where || {}), organizationId: orgId } })
        }

        if (operation === 'create') {
          return query({ ...aIn, data: { ...(aIn.data || {}), organizationId: orgId } })
        }
        if (operation === 'createMany') {
          const data = Array.isArray(aIn.data)
            ? aIn.data.map((d: Record<string, unknown>) => ({ ...d, organizationId: orgId }))
            : { ...(aIn.data || {}), organizationId: orgId }
          return query({ ...aIn, data })
        }

        if (operation === 'upsert') {
          return query({
            ...aIn,
            where: { ...(aIn.where || {}), organizationId: orgId },
            create: { ...(aIn.create || {}), organizationId: orgId },
          })
        }

        if (operation === 'update' || operation === 'delete') {
          return query({ ...aIn, where: { ...(aIn.where || {}), organizationId: orgId } })
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
