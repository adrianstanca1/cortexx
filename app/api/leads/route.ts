import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 100
const ALLOWED_STATUS = new Set(['new', 'qualified', 'proposing', 'won', 'lost'])

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const take = Math.min(parseInt(searchParams.get('take') || '50') || 50, MAX_TAKE)

    const where = {
      ...(status && ALLOWED_STATUS.has(status) && { status }),
    }
    const [leads, openCount, pipelineValue] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take,
      }),
      prisma.lead.count({ where: { ...where, status: { notIn: ['won', 'lost'] } } }),
      prisma.lead.aggregate({
        where: { status: { notIn: ['won', 'lost'] } },
        _sum: { value: true },
      }),
    ])
    return NextResponse.json({
      leads,
      openCount,
      pipelineValue: pipelineValue._sum.value || 0,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const name = String(body.name || '').trim()
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const value = body.value === undefined || body.value === null || body.value === ''
      ? 0
      : Number(body.value)
    if (isNaN(value)) return NextResponse.json({ error: 'Value must be a number' }, { status: 400 })

    const lead = await prisma.lead.create({
      data: {
        name,
        contactName: body.contactName?.toString().trim() || null,
        contactEmail: body.contactEmail?.toString().trim() || null,
        contactPhone: body.contactPhone?.toString().trim() || null,
        address: body.address?.toString().trim() || null,
        postcode: body.postcode?.toString().trim() || null,
        source: body.source?.toString().trim() || null,
        status: ALLOWED_STATUS.has(body.status) ? body.status : 'new',
        value,
        notes: body.notes?.toString().trim() || null,
      },
    })
    return NextResponse.json(lead, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }
}
