import type { prisma } from './db'
import { supplierQuality } from './supplier-quality'

type QualityClient = Pick<typeof prisma, 'supplierQualityEvidence' | 'snag' | 'inspection' | 'purchaseOrder'>
export const QUALITY_HISTORY_LIMIT = 1000
export const defectSelect = {
  id: true, title: true, description: true, status: true, priority: true,
  dueDate: true, closedAt: true, updatedAt: true, projectId: true,
  project: { select: { id: true, name: true } },
} as const
export const inspectionSelect = {
  id: true, title: true, type: true, status: true, overallResult: true,
  completedAt: true, notes: true, updatedAt: true, projectId: true,
  project: { select: { id: true, name: true } },
} as const

export async function loadSupplierQuality(db: QualityClient, organizationId: string, supplierId: string, now = new Date()) {
  const found = await db.supplierQualityEvidence.findMany({
    where: { organizationId, supplierId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: QUALITY_HISTORY_LIMIT + 1,
    select: {
      id: true, reason: true, createdBy: true, createdAt: true,
      withdrawnAt: true, withdrawnBy: true, withdrawalReason: true,
      snagId: true, inspectionId: true, purchaseOrderId: true,
    },
  })
  const records = found.slice(0, QUALITY_HISTORY_LIMIT)
  const ids = (key: 'snagId' | 'inspectionId' | 'purchaseOrderId') => [...new Set(records.map(row => row[key]).filter((id): id is string => !!id))]
  // Read sources explicitly under both tenant and project scope rather than
  // trusting nested includes or the automatic tenancy extension.
  const [snags, inspections, orders] = await Promise.all([
    records.some(row => row.snagId) ? db.snag.findMany({
      where: { id: { in: ids('snagId') }, organizationId, project: { organizationId } }, select: defectSelect,
    }) : [],
    records.some(row => row.inspectionId) ? db.inspection.findMany({
      where: { id: { in: ids('inspectionId') }, organizationId, project: { organizationId } }, select: inspectionSelect,
    }) : [],
    records.some(row => row.purchaseOrderId) ? db.purchaseOrder.findMany({
      where: { id: { in: ids('purchaseOrderId') }, organizationId, supplierId, project: { organizationId } },
      select: { id: true, number: true },
    }) : [],
  ])
  const snagMap = new Map(snags.map(source => [source.id, { ...source, sourceType: 'snag' as const }]))
  const inspectionMap = new Map(inspections.map(source => [source.id, { ...source, sourceType: 'inspection' as const }]))
  const orderMap = new Map(orders.map(order => [order.id, order]))
  return {
    ...supplierQuality(records.map(row => ({
      ...row,
      source: row.snagId ? snagMap.get(row.snagId) || null : inspectionMap.get(row.inspectionId || '') || null,
      purchaseOrder: row.purchaseOrderId ? orderMap.get(row.purchaseOrderId) || null : null,
    })), now),
    truncated: found.length > QUALITY_HISTORY_LIMIT,
  }
}
