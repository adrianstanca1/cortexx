import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { project: true },
    })
    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ invoice })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (limited) return limited
  try {
    const body = await req.json()
    if (body.amount !== undefined && (!Number.isFinite(Number(body.amount)) || Number(body.amount) <= 0)) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }
    // Client invoices are revenue. Never write them into Project.spent, which
    // is a cost-side field used by project margin/commercial reporting.
    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.amount !== undefined && { amount: Number(body.amount) }),
        ...(body.clientName !== undefined && { clientName: body.clientName }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.dueDate && { dueDate: new Date(body.dueDate) }),
        ...(body.paidDate !== undefined && { paidDate: body.paidDate ? new Date(body.paidDate) : null }),
        ...(body.status === 'paid' && !body.paidDate && { paidDate: new Date() }),
      },
      include: { project: true },
    })
    auditLog({
      action: 'invoice.update',
      resourceType: 'Invoice',
      resourceId: invoice.id,
      metadata: { status: invoice.status, amount: invoice.amount },
      ...requestMeta(req),
    })
    return NextResponse.json(invoice)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    // Block deletion of paid invoices — preserves accounting integrity
    const existing = await prisma.invoice.findUnique({
      where: { id: params.id },
      select: { status: true, projectId: true, number: true },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.status === 'paid') {
      return NextResponse.json(
        { error: 'Cannot delete a paid invoice. Mark it as draft first if you need to remove it.' },
        { status: 409 }
      )
    }

    await prisma.invoice.delete({ where: { id: params.id } })
    auditLog({
      action: 'invoice.delete',
      resourceType: 'Invoice',
      resourceId: params.id,
      ...requestMeta(req),
    })


    // Log activity (non-blocking)
    if (existing.projectId) {
      prisma.activity.create({
        data: {
          projectId: existing.projectId,
          actorName: actorName(auth),
          actorType: 'human',
          action: `deleted invoice ${existing.number}`,
          iconType: 'receipt',
        },
      }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 })
  }
}
