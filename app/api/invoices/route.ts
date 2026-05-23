import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')

    const invoices = await prisma.invoice.findMany({
      where: {
        ...(projectId && { projectId }),
        ...(status && { status }),
      },
      include: { project: true },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    })
    return NextResponse.json({ invoices })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.number?.trim()) {
      return NextResponse.json({ error: 'Invoice number is required' }, { status: 400 })
    }
    if (!body.clientName?.trim()) {
      return NextResponse.json({ error: 'Client name is required' }, { status: 400 })
    }
    if (body.amount === undefined || body.amount === null || isNaN(Number(body.amount)) || Number(body.amount) <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }
    if (!body.dueDate) {
      return NextResponse.json({ error: 'Due date is required' }, { status: 400 })
    }
    try {
      const invoice = await prisma.invoice.create({
        data: {
          number: body.number.trim(),
          projectId: body.projectId || null,
          clientName: body.clientName.trim(),
          amount: Number(body.amount),
          status: body.status || 'draft',
          issuedDate: body.issuedDate ? new Date(body.issuedDate) : new Date(),
          dueDate: new Date(body.dueDate),
          notes: body.notes || null,
        },
        include: { project: true },
      })
      return NextResponse.json(invoice, { status: 201 })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return NextResponse.json({ error: `Invoice number "${body.number}" already exists` }, { status: 409 })
      }
      throw err
    }
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}
