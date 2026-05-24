import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 200

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const archived = searchParams.get('archived') === 'true'
    const search = searchParams.get('search')?.trim()
    const take = Math.min(parseInt(searchParams.get('take') || '100') || 100, MAX_TAKE)

    const where = {
      ...(archived ? { archivedAt: { not: null } } : { archivedAt: null }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { contactName: { contains: search, mode: 'insensitive' as const } },
          { contactEmail: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: { _count: { select: { quotes: true } } },
        orderBy: { name: 'asc' },
        take,
      }),
      prisma.customer.count({ where: { archivedAt: null } }),
    ])
    return NextResponse.json({ customers, total })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const name = String(body.name || '').trim()
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const customer = await prisma.customer.create({
      data: {
        name,
        contactName: body.contactName?.toString().trim() || null,
        contactEmail: body.contactEmail?.toString().trim() || null,
        contactPhone: body.contactPhone?.toString().trim() || null,
        address: body.address?.toString().trim() || null,
        postcode: body.postcode?.toString().trim() || null,
        notes: body.notes?.toString().trim() || null,
      },
    })
    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
  }
}
