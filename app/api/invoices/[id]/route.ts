import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
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
        // Auto-set paidDate when marking paid
        ...(body.status === 'paid' && !body.paidDate && { paidDate: new Date() }),
      },
      include: { project: true },
    })

    // Auto-recalculate project.spent from paid invoices
    if (body.status !== undefined && invoice.projectId) {
      const paidInvoices = await prisma.invoice.findMany({
        where: { projectId: invoice.projectId, status: 'paid' },
        select: { amount: true },
      })
      const spent = paidInvoices.reduce((sum, i) => sum + i.amount, 0)
      await prisma.project.update({ where: { id: invoice.projectId }, data: { spent } })
    }

    return NextResponse.json(invoice)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.invoice.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 })
  }
}
