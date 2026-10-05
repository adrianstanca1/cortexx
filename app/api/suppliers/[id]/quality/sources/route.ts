import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { reportError } from '@/lib/errors'
import { defectSelect, inspectionSelect } from '@/lib/supplier-quality-server'

export const dynamic = 'force-dynamic'
const SOURCE_LIMIT = 25
const ORDER_LIMIT = 100

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId || !canManage(auth.role || '')) return NextResponse.json({ error: 'Company Admin permission required' }, { status: 403 })
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const sourceType = searchParams.get('sourceType') || 'snag'
  const q = (searchParams.get('q') || '').trim()
  if (!['snag', 'inspection'].includes(sourceType) || q.length > 100) return NextResponse.json({ error: 'Choose a valid source type and search of up to 100 characters' }, { status: 400 })
  const organizationId = auth.orgId
  try {
    const supplier = await prisma.supplier.findFirst({ where: { id, organizationId }, select: { id: true } })
    if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    const where = {
      organizationId, project: { organizationId },
      supplierQualityEvidence: { none: { supplierId: id, organizationId } },
      ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}),
    }
    const [sources, orders] = await Promise.all([
      sourceType === 'snag'
        ? prisma.snag.findMany({ where, select: defectSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: SOURCE_LIMIT + 1 })
        : prisma.inspection.findMany({ where: { ...where, type: 'quality' }, select: inspectionSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: SOURCE_LIMIT + 1 }),
      prisma.purchaseOrder.findMany({
        where: { supplierId: id, organizationId, project: { organizationId }, status: { in: ['approved', 'sent', 'part_received', 'received', 'closed'] } },
        select: { id: true, number: true, projectId: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: ORDER_LIMIT + 1,
      }),
    ])
    return NextResponse.json({
      sources: sources.slice(0, SOURCE_LIMIT), truncated: sources.length > SOURCE_LIMIT,
      purchaseOrders: orders.slice(0, ORDER_LIMIT), ordersTruncated: orders.length > ORDER_LIMIT,
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Could not load supplier evidence sources' }, { status: 500 })
  }
}
