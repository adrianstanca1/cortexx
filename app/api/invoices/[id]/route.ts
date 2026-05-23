import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

async function recalcSpent(projectId: string) {
  const paidInvoices = await prisma.invoice.findMany({
    where: { projectId, status: 'paid' },
    select: { amount: true },
  })
  const spent = paidInvoices.reduce((sum, i) => sum + i.amount, 0)
  await prisma.project.update({ where: { id: projectId }, data: { spent } })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    if (body.amount !== undefined && (isNaN(Number(body.amount)) || Number(body.amount) <= 0)) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }
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

    if (body.status !== undefined && invoice.projectId) {
      await recalcSpent(invoice.projectId)
    }

    return NextResponse.json(invoice)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
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

    // Keep project.spent in sync (was non-paid so spent shouldn't change, but be safe)
    if (existing.projectId) await recalcSpent(existing.projectId)

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
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 })
  }
}
