import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canWrite } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'
import controls from '@/lib/field-controls'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 200

function publishedAt(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string') return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  try {
    const sp = req.nextUrl.searchParams
    const take = Math.min(parseInt(sp.get('take') || '50') || 50, MAX_TAKE)
    const skip = Math.max(0, parseInt(sp.get('skip') || '0') || 0)
    const [items, total] = await Promise.all([
      prisma.processDoc.findMany({
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take,
        skip,
      }),
      prisma.processDoc.count(),
    ])
    return NextResponse.json({ items, total, hasMore: skip + items.length < total })
  } catch (error) {
    reportError(error, { context: 'process-library.list' })
    return NextResponse.json({ error: 'Failed to fetch process library' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '')) return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId || '')
  if (limited) return limited

  try {
    const body = await req.json().catch(() => ({}))
    const title = controls.cleanText(body.title, 220)
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

    const date = publishedAt(body.publishedAt)
    if (body.publishedAt !== undefined && date === undefined) {
      return NextResponse.json({ error: 'publishedAt must be a valid date' }, { status: 400 })
    }

    const item = await prisma.processDoc.create({
      data: {
        title,
        category: controls.cleanText(body.category, 80) || null,
        body: controls.cleanText(body.body, 12000) || null,
        owner: controls.cleanText(body.owner, 120) || null,
        version: controls.cleanText(body.version, 40) || '1.0',
        publishedAt: date ?? null,
      },
    })

    auditLog({
      action: 'process-library.create',
      resourceType: 'ProcessDoc',
      resourceId: item.id,
      metadata: { category: item.category, version: item.version },
      ...requestMeta(req),
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    reportError(error, { context: 'process-library.create' })
    return NextResponse.json({ error: 'Failed to create process' }, { status: 500 })
  }
}
