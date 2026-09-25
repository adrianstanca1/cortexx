import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { reportError } from '@/lib/errors'
import performance from '@/lib/supplier-performance'

export const dynamic = 'force-dynamic'
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId || !canManage(auth.role || '')) {
    return NextResponse.json({ error: 'Company Admin permission required' }, { status: 403 })
  }
  try {
    const { id } = await params
    const supplier = await prisma.supplier.findFirst({
      where: { id, organizationId: auth.orgId },
      select: { id: true, name: true, category: true, archivedAt: true },
    })
    if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    const orders = await prisma.purchaseOrder.findMany({
      where: { supplierId: id, organizationId: auth.orgId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1001,
      select: {
        id: true, number: true, status: true, subtotal: true, expectedDelivery: true, receivedAt: true,
        goodsReceipts: { where: { organizationId: auth.orgId }, select: { netReceived: true, deliveredAt: true } },
      },
    })
    return NextResponse.json({
      supplier, performance: performance.supplierPerformance(orders.slice(0, 1000)),
      truncated: orders.length > 1000, asOf: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Could not load supplier performance' }, { status: 500 })
  }
}
