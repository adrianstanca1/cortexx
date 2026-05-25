import { NextRequest, NextResponse } from 'next/server'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 100

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')
    const take = Math.min(parseInt(searchParams.get('take') || '50') || 50, MAX_TAKE)
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0') || 0)

    const where = { ...(projectId && { projectId }), ...(status && { status }) }
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: { project: true },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
        take,
        skip,
      }),
      prisma.invoice.count({ where }),
    ])
    return NextResponse.json({ invoices, total, hasMore: skip + invoices.length < total })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
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
