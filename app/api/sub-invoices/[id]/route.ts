import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = new Set(['received', 'approved', 'paid', 'disputed'])

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const existing = await prisma.subInvoice.findUnique({ where: { id: params.id }, select: { status: true, paidAt: true } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (body.description !== undefined) data.description = body.description?.toString().trim() || null
    if (body.notes !== undefined) data.notes = body.notes?.toString().trim() || null
    if (body.status !== undefined && ALLOWED_STATUS.has(body.status)) {
      data.status = body.status
      if (body.status === 'paid' && !existing.paidAt) data.paidAt = new Date()
      if (body.status !== 'paid' && existing.paidAt) data.paidAt = null
    }
    const invoice = await prisma.subInvoice.update({
      where: { id: params.id },
      data,
      include: {
        subcontractor: { select: { id: true, name: true, trade: true, cisStatus: true } },
        project: { select: { id: true, name: true } },
      },
    })
    return NextResponse.json(invoice)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    await prisma.subInvoice.delete({ where: { id: params.id } })
    auditLog({
      action: 'subInvoice.delete',
      resourceType: 'SubInvoice',
      resourceId: params.id,
      ...requestMeta(req),
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
