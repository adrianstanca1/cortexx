import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const ALLOWED_CATEGORY = new Set(['materials', 'plant', 'services', 'other'])

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const includeArchived = searchParams.get('includeArchived') === '1'
    const search = searchParams.get('q')?.trim()

    const where = {
      ...(category && ALLOWED_CATEGORY.has(category) && { category }),
      ...(!includeArchived && { archivedAt: null }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { contactName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }
    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: [{ name: 'asc' }],
      take: 300,
    })
    return NextResponse.json({ suppliers, total: suppliers.length })
  } catch (error) {
    console.error('[suppliers] GET failed:', error)
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 })
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
    const category = ALLOWED_CATEGORY.has(body.category) ? body.category : 'materials'

    const supplier = await prisma.supplier.create({
      data: {
        name: name.slice(0, 200),
        category,
        contactName: typeof body.contactName === 'string' && body.contactName ? body.contactName.slice(0, 100) : null,
        contactEmail: typeof body.contactEmail === 'string' && body.contactEmail ? body.contactEmail.slice(0, 200) : null,
        contactPhone: typeof body.contactPhone === 'string' && body.contactPhone ? body.contactPhone.slice(0, 50) : null,
        address: typeof body.address === 'string' && body.address ? body.address.slice(0, 200) : null,
        postcode: typeof body.postcode === 'string' && body.postcode ? body.postcode.slice(0, 20) : null,
        paymentTerms: typeof body.paymentTerms === 'string' && body.paymentTerms ? body.paymentTerms.slice(0, 50) : null,
        accountNumber: typeof body.accountNumber === 'string' && body.accountNumber ? body.accountNumber.slice(0, 50) : null,
        notes: typeof body.notes === 'string' && body.notes ? body.notes.slice(0, 2000) : null,
      },
    })
    return NextResponse.json(supplier, { status: 201 })
  } catch (error) {
    console.error('[suppliers] POST failed:', error)
    return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 })
  }
}
