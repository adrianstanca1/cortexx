import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = new Set(['new', 'qualified', 'proposing', 'won', 'lost'])

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const existing = await prisma.lead.findUnique({ where: { id: params.id }, select: { status: true, convertedAt: true } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (body.name !== undefined && !String(body.name).trim()) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = String(body.name).trim()
    if (body.contactName !== undefined) data.contactName = body.contactName?.toString().trim() || null
    if (body.contactEmail !== undefined) data.contactEmail = body.contactEmail?.toString().trim() || null
    if (body.contactPhone !== undefined) data.contactPhone = body.contactPhone?.toString().trim() || null
    if (body.address !== undefined) data.address = body.address?.toString().trim() || null
    if (body.postcode !== undefined) data.postcode = body.postcode?.toString().trim() || null
    if (body.source !== undefined) data.source = body.source?.toString().trim() || null
    if (body.notes !== undefined) data.notes = body.notes?.toString().trim() || null
    if (body.lostReason !== undefined) data.lostReason = body.lostReason?.toString().trim() || null
    if (body.value !== undefined) {
      const v = Number(body.value)
      if (isNaN(v)) return NextResponse.json({ error: 'Value must be a number' }, { status: 400 })
      data.value = v
    }
    if (body.status !== undefined && ALLOWED_STATUS.has(body.status)) {
      data.status = body.status
      if (body.status === 'won' && existing.status !== 'won') data.convertedAt = new Date()
      if (body.status !== 'won' && existing.convertedAt) data.convertedAt = null
    }

    const lead = await prisma.lead.update({ where: { id: params.id }, data })
    return NextResponse.json(lead)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    await prisma.lead.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
  }
}

// POST converts a Lead into a Customer (status → won + creates Customer)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    if (searchParams.get('action') !== 'convert') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
    const lead = await prisma.lead.findUnique({ where: { id: params.id } })
    if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (lead.status === 'won') return NextResponse.json({ error: 'Already converted' }, { status: 400 })

    const [customer, updated] = await prisma.$transaction([
      prisma.customer.create({
        data: {
          name: lead.name,
          contactName: lead.contactName,
          contactEmail: lead.contactEmail,
          contactPhone: lead.contactPhone,
          address: lead.address,
          postcode: lead.postcode,
          notes: lead.notes,
        },
      }),
      prisma.lead.update({
        where: { id: params.id },
        data: { status: 'won', convertedAt: new Date() },
      }),
    ])
    return NextResponse.json({ customer, lead: updated })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to convert' }, { status: 500 })
  }
}
