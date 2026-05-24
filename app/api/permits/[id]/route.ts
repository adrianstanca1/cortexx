import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPE = new Set(['hot_work', 'confined_space', 'excavation', 'working_at_height', 'electrical', 'general'])
const ALLOWED_STATUS = new Set(['draft', 'active', 'expired', 'cancelled'])
const ALLOWED_RISK = new Set(['low', 'medium', 'high', 'critical'])

function parseDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const d = new Date(v as string)
  return isNaN(d.getTime()) ? undefined : d
}

export async function PATCH(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const existing = await prisma.permit.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim().slice(0, 200)
    if (typeof body.type === 'string' && ALLOWED_TYPE.has(body.type)) data.type = body.type
    if (typeof body.status === 'string' && ALLOWED_STATUS.has(body.status)) data.status = body.status
    if (typeof body.riskLevel === 'string' && ALLOWED_RISK.has(body.riskLevel)) data.riskLevel = body.riskLevel
    if (typeof body.location === 'string') data.location = body.location.slice(0, 200) || null
    if (typeof body.issuedBy === 'string') data.issuedBy = body.issuedBy.slice(0, 100) || null
    if (typeof body.issuedTo === 'string') data.issuedTo = body.issuedTo.slice(0, 100) || null
    if (typeof body.conditions === 'string') data.conditions = body.conditions.slice(0, 2000) || null
    if (typeof body.notes === 'string') data.notes = body.notes.slice(0, 1000) || null
    if ('validFrom' in body) {
      const d = parseDate(body.validFrom)
      if (d === undefined && body.validFrom) return NextResponse.json({ error: 'Invalid validFrom' }, { status: 400 })
      data.validFrom = d ?? null
    }
    if ('validTo' in body) {
      const d = parseDate(body.validTo)
      if (d === undefined && body.validTo) return NextResponse.json({ error: 'Invalid validTo' }, { status: 400 })
      data.validTo = d ?? null
    }

    const finalFrom = (data.validFrom as Date | null | undefined) ?? existing.validFrom
    const finalTo = (data.validTo as Date | null | undefined) ?? existing.validTo
    if (finalFrom && finalTo && finalTo < finalFrom) {
      return NextResponse.json({ error: 'validTo must be on or after validFrom' }, { status: 400 })
    }

    const permit = await prisma.permit.update({
      where: { id: params.id },
      data,
      include: { project: { select: { id: true, name: true } } },
    })

    if (data.status && data.status !== existing.status) {
      prisma.activity.create({
        data: {
          projectId: permit.projectId,
          actorName: actorName(auth),
          actorType: 'human',
          action: `${data.status === 'active' ? 'activated' : data.status === 'cancelled' ? 'cancelled' : 'updated'} permit: ${permit.title}`,
          iconType: 'alert',
        },
      }).catch(() => {})
    }
    return NextResponse.json(permit)
  } catch (error) {
    console.error('[permits/:id] PATCH failed:', error)
    return NextResponse.json({ error: 'Failed to update permit' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const permit = await prisma.permit.findUnique({ where: { id: params.id } })
    if (!permit) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.permit.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[permits/:id] DELETE failed:', error)
    return NextResponse.json({ error: 'Failed to delete permit' }, { status: 500 })
  }
}
