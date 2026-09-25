import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { reportError } from '@/lib/errors'
import procurementRfq from '@/lib/procurement-rfq'

export const dynamic = 'force-dynamic'
const ALLOWED_STATUS = new Set(['draft', 'sent', 'awarded', 'closed', 'cancelled'])
const { compareSupplierQuotes } = procurementRfq

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const requisitionId = searchParams.get('requisitionId')
    const rfqs = await prisma.procurementRfq.findMany({
      where: {
        ...(requisitionId && { requisitionId }),
        ...(status && ALLOWED_STATUS.has(status) && { status }),
      },
      include: {
        requisition: {
          include: {
            project: { select: { id: true, name: true } },
            costCode: { select: { id: true, code: true, name: true } },
            purchaseOrder: { select: { id: true, number: true, status: true, total: true } },
          },
        },
        quotes: {
          include: {
            supplier: {
              select: {
                id: true, name: true, category: true,
                contactEmail: true, contactPhone: true, paymentTerms: true,
              },
            },
          },
          orderBy: { receivedAt: 'asc' },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
    })

    const allSupplierIds = Array.from(new Set(rfqs.flatMap(rfq =>
      Array.isArray(rfq.supplierIds)
        ? rfq.supplierIds.map(value => String(value))
        : [],
    )))
    const suppliers = allSupplierIds.length
      ? await prisma.supplier.findMany({
          where: { id: { in: allSupplierIds } },
          select: {
            id: true, name: true, category: true,
            contactEmail: true, contactPhone: true, paymentTerms: true, archivedAt: true,
          },
        })
      : []
    const supplierMap = new Map(suppliers.map(supplier => [supplier.id, supplier]))

    const result = rfqs.map(rfq => {
      const invitedIds = Array.isArray(rfq.supplierIds)
        ? rfq.supplierIds.map(value => String(value))
        : []
      return {
        ...rfq,
        invitedSuppliers: invitedIds.map(id => supplierMap.get(id)).filter(Boolean),
        comparison: compareSupplierQuotes(rfq.quotes as unknown as any[]),
      }
    })

    return NextResponse.json({ rfqs: result })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch RFQs' }, { status: 500 })
  }
}
