type Tx = {
  projectCostEntry: { aggregate(args: any): Promise<any>; findFirst(args: any): Promise<any>; update(args: any): Promise<any>; create(args: any): Promise<any> }
  project: { update(args: any): Promise<any> }
}

type SourcePosting = {
  organizationId: string
  projectId: string
  sourceType: 'receipt' | 'sub_invoice' | 'manual' | 'import'
  sourceId?: string | null
  sourceReference?: string | null
  description: string
  netAmount: number
  vatAmount?: number
  grossAmount?: number
  costCodeId?: string | null
  occurredAt?: Date
  notes?: string | null
}

export async function syncProjectSpent(tx: Tx, projectId: string, organizationId: string) {
  const totals = await tx.projectCostEntry.aggregate({
    where: { projectId, organizationId, status: 'posted' },
    _sum: { netAmount: true },
  })
  const spent = Math.round(((totals._sum.netAmount || 0) + Number.EPSILON) * 100) / 100
  await tx.project.update({ where: { id: projectId, organizationId }, data: { spent } })
  return spent
}

export async function postSourceCost(tx: Tx, posting: SourcePosting) {
  const grossAmount = posting.grossAmount ?? posting.netAmount + (posting.vatAmount || 0)
  const data = {
    projectId: posting.projectId,
    costCodeId: posting.costCodeId || null,
    sourceType: posting.sourceType,
    sourceId: posting.sourceId || null,
    sourceReference: posting.sourceReference || null,
    description: posting.description.trim().slice(0, 500),
    netAmount: posting.netAmount,
    vatAmount: posting.vatAmount || 0,
    grossAmount,
    status: 'posted',
    occurredAt: posting.occurredAt || new Date(),
    postedAt: new Date(),
    voidedAt: null,
    notes: posting.notes || null,
    organizationId: posting.organizationId,
  }

  let entry = posting.sourceId
    ? await tx.projectCostEntry.findFirst({ where: { organizationId: posting.organizationId, sourceType: posting.sourceType, sourceId: posting.sourceId } })
    : null

  if (entry) {
    entry = await tx.projectCostEntry.update({ where: { id: entry.id }, data })
  } else {
    entry = await tx.projectCostEntry.create({ data })
  }
  await syncProjectSpent(tx, posting.projectId, posting.organizationId)
  return entry
}

export async function voidSourceCost(tx: Tx, organizationId: string, sourceType: string, sourceId: string) {
  const existing = await tx.projectCostEntry.findFirst({ where: { organizationId, sourceType, sourceId } })
  if (!existing || existing.status === 'void') return existing
  const entry = await tx.projectCostEntry.update({ where: { id: existing.id }, data: { status: 'void', voidedAt: new Date() } })
  await syncProjectSpent(tx, existing.projectId, organizationId)
  return entry
}
