import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 500
const COMMON_UNITS = new Set(['item', 'hour', 'day', 'm', 'm²', 'm³', 'kg', 'tonne', 'l', 'visit'])

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')?.trim()
    const archived = searchParams.get('archived') === 'true'
    const take = Math.min(parseInt(searchParams.get('take') || '200') || 200, MAX_TAKE)

    const where = {
      ...(category && { category }),
      ...(archived ? { archivedAt: { not: null } } : { archivedAt: null }),
      ...(search && {
        OR: [
          { description: { contains: search, mode: 'insensitive' as const } },
          { code: { contains: search, mode: 'insensitive' as const } },
          { vendor: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }
    const [items, categories] = await Promise.all([
      prisma.costItem.findMany({ where, orderBy: [{ category: 'asc' }, { description: 'asc' }], take }),
      prisma.costItem.findMany({ where: { archivedAt: null, category: { not: null } }, distinct: ['category'], select: { category: true } }),
    ])
    return NextResponse.json({
      items,
      categories: categories.map(c => c.category).filter(Boolean).sort(),
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch catalog' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json()
    const description = String(body.description || '').trim()
    if (!description) return NextResponse.json({ error: 'Description is required' }, { status: 400 })

    const unitCost = body.unitCost === undefined || body.unitCost === null || body.unitCost === ''
      ? 0
      : Number(body.unitCost)
    if (isNaN(unitCost) || unitCost < 0) return NextResponse.json({ error: 'Unit cost must be a non-negative number' }, { status: 400 })

    const unit = body.unit && COMMON_UNITS.has(body.unit) ? body.unit : 'item'

    const item = await prisma.costItem.create({
      data: {
        code: body.code?.toString().trim() || null,
        description,
        category: body.category?.toString().trim() || null,
        unit,
        unitCost,
        vendor: body.vendor?.toString().trim() || null,
        notes: body.notes?.toString().trim() || null,
      },
    })
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 })
  }
}
