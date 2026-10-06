import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(value)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId || !auth.userId || !canManage(auth.role || '')) return NextResponse.json({ error: 'Company Admin permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['sourceType', 'sourceId', 'purchaseOrderId', 'reason'].includes(key)) ||
    !['snag', 'inspection'].includes(body.sourceType) || !validId(body.sourceId) ||
    (body.purchaseOrderId !== undefined && body.purchaseOrderId !== null && body.purchaseOrderId !== '' && !validId(body.purchaseOrderId)) || typeof body.reason !== 'string' || body.reason.trim().length < 3 || body.reason.trim().length > 2000) {
    return NextResponse.json({ error: 'Select a defect or quality inspection and give an attribution reason of 3–2,000 characters' }, { status: 400 })
  }
  const organizationId = auth.orgId
  const userId = auth.userId
  try {
    const evidence = await prisma.$transaction(async tx => {
      const supplier = await tx.supplier.findFirst({ where: { id, organizationId }, select: { id: true } })
      if (!supplier) throw new Error('SUPPLIER_NOT_FOUND')
      const sourceWhere = { id: body.sourceId, organizationId, project: { organizationId } }
      const source = body.sourceType === 'snag'
        ? await tx.snag.findFirst({ where: sourceWhere, select: { id: true, projectId: true } })
        : await tx.inspection.findFirst({ where: { ...sourceWhere, type: 'quality' }, select: { id: true, projectId: true } })
      if (!source) throw new Error('SOURCE_NOT_FOUND')
      const purchaseOrderId = body.purchaseOrderId || null
      if (purchaseOrderId) {
        const order = await tx.purchaseOrder.findFirst({
          where: { id: purchaseOrderId, organizationId, supplierId: id, projectId: source.projectId,
            status: { in: ['approved', 'sent', 'part_received', 'received', 'closed'] } }, select: { id: true },
        })
        if (!order) throw new Error('ORDER_NOT_FOUND')
      }
      const linked = await tx.supplierQualityEvidence.create({ data: {
        organizationId, supplierId: id, projectId: source.projectId,
        snagId: body.sourceType === 'snag' ? source.id : null,
        inspectionId: body.sourceType === 'inspection' ? source.id : null,
        purchaseOrderId, reason: body.reason.trim(), createdBy: userId,
      } })
      await tx.auditEvent.create({ data: {
        organizationId, userId: auth.userId, action: 'supplier.quality.link', resourceType: 'SupplierQualityEvidence', resourceId: linked.id,
        metadata: { supplierId: id, sourceType: body.sourceType, sourceId: source.id, purchaseOrderId, reason: body.reason.trim() }, ...requestMeta(req),
      } })
      return linked
    }, { isolationLevel: 'Serializable' })
    return NextResponse.json({ id: evidence.id }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof Error && ['SUPPLIER_NOT_FOUND', 'SOURCE_NOT_FOUND', 'ORDER_NOT_FOUND'].includes(error.message)) {
      return NextResponse.json({ error: 'Supplier, source or eligible purchase order not found in this company and project' }, { status: 404 })
    }
    const code = (error as { code?: string })?.code
    if (code === 'P2002') return NextResponse.json({ error: 'This source already has an attribution for this supplier, including withdrawn history' }, { status: 409 })
    if (code === 'P2003' || code === 'P2034') return NextResponse.json({ error: 'The linked records changed. Reload the evidence and try again.' }, { status: 409 })
    reportError(error)
    return NextResponse.json({ error: 'Could not record supplier quality evidence' }, { status: 500 })
  }
}
