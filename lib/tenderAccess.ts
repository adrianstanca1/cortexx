import type { Prisma } from '@prisma/client'
import { canManage } from '@/lib/rbac'

/** Commercial bid values and bidder strengths are company-confidential.
 * Align permissions with Quotes/Finance, never with field-user access. */
export interface TenderActor {
  role: string | null
  orgId: string | null
}

export function canManageTenders(actor: TenderActor): boolean {
  return Boolean(actor.orgId && actor.role && canManage(actor.role))
}

/** Even administrators must never see another organization's tenders.
 * For historic orphan project associations, the project must match too. */
export function tenderWhere(actor: TenderActor): Prisma.TenderWhereInput {
  if (!actor.orgId) return { id: '__no_access__' }
  return {
    organizationId: actor.orgId,
    OR: [
      { projectId: null },
      { project: { is: { organizationId: actor.orgId } } },
    ],
  }
}
