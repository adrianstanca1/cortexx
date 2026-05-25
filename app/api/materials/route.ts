import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 500
const ALLOWED_UNITS = new Set(['item', 'm', 'm²', 'm³', 'kg', 'tonne', 'l', 'pack', 'roll', 'sheet'])

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')?.trim()
    const lowStock = searchParams.get('lowStock') === 'true'
    const archived = searchParams.get('archived') === 'true'
    const take = Math.min(parseInt(searchParams.get('take') || '200') || 200, MAX_TAKE)

    const where = {
      ...(category && { category }),
      ...(archived ? { archivedAt: { not: null } } : { archivedAt: null }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { code: { contains: search, mode: 'insensitive' as const } },
          { supplier: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }
    const [items, categories, all] = await Promise.all([
      prisma.material.findMany({ where, orderBy: [{ category: 'asc' }, { name: 'asc' }], take }),
      prisma.material.findMany({ where: { archivedAt: null, category: { not: null } }, distinct: ['category'], select: { category: true } }),
      prisma.material.findMany({ where: { archivedAt: null }, select: { stockLevel: true, reorderPoint: true } }),
    ])
    const filtered = lowStock ? items.filter(i => i.stockLevel <= i.reorderPoint && i.reorderPoint > 0) : items
    const lowStockCount = all.filter(m => m.stockLevel <= m.reorderPoint && m.reorderPoint > 0).length
    return NextResponse.json({
      materials: filtered,
      categories: categories.map(c => c.category).filter(Boolean).sort(),
      lowStockCount,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch materials' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json()
    const name = String(body.name || '').trim()
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    const unitCost = body.unitCost === undefined || body.unitCost === '' ? 0 : Number(body.unitCost)
    if (isNaN(unitCost) || unitCost < 0) return NextResponse.json({ error: 'Unit cost must be ≥ 0' }, { status: 400 })
    const stockLevel = body.stockLevel === undefined || body.stockLevel === '' ? 0 : Number(body.stockLevel)
    if (isNaN(stockLevel) || stockLevel < 0) return NextResponse.json({ error: 'Stock level must be ≥ 0' }, { status: 400 })
    const reorderPoint = body.reorderPoint === undefined || body.reorderPoint === '' ? 0 : Number(body.reorderPoint)
    if (isNaN(reorderPoint) || reorderPoint < 0) return NextResponse.json({ error: 'Reorder point must be ≥ 0' }, { status: 400 })
    const unit = body.unit && ALLOWED_UNITS.has(body.unit) ? body.unit : 'item'

    const material = await prisma.material.create({
      data: {
        name,
        code: body.code?.toString().trim() || null,
        category: body.category?.toString().trim() || null,
        unit,
        unitCost,
        stockLevel,
        reorderPoint,
        supplier: body.supplier?.toString().trim() || null,
        location: body.location?.toString().trim() || null,
        notes: body.notes?.toString().trim() || null,
      },
    })
    return NextResponse.json(material, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create material' }, { status: 500 })
  }
}
