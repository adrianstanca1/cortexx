import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPE = new Set(['rams', 'risk_assessment', 'method_statement'])
const ALLOWED_STATUS = new Set(['draft', 'active', 'expired', 'archived'])

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
    const existing = await prisma.rams.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim().slice(0, 200)
    if (typeof body.type === 'string' && ALLOWED_TYPE.has(body.type)) data.type = body.type
    if (typeof body.status === 'string' && ALLOWED_STATUS.has(body.status)) data.status = body.status
    if (typeof body.hazards === 'string') data.hazards = body.hazards.slice(0, 4000) || null
    if (typeof body.controls === 'string') data.controls = body.controls.slice(0, 4000) || null
    if (typeof body.ppe === 'string') data.ppe = body.ppe.slice(0, 1000) || null
    if (typeof body.notes === 'string') data.notes = body.notes.slice(0, 2000) || null
    if ('reviewBy' in body) {
      const d = parseDate(body.reviewBy)
      if (d === undefined && body.reviewBy) return NextResponse.json({ error: 'Invalid reviewBy' }, { status: 400 })
      data.reviewBy = d ?? null
    }
    // Sign-off: setting signedBy stamps signedAt automatically; clearing it
    // wipes the timestamp.
    if (typeof body.signedBy === 'string') {
      const trimmed = body.signedBy.trim().slice(0, 100)
      data.signedBy = trimmed || null
      data.signedAt = trimmed ? new Date() : null
    }

    const doc = await prisma.rams.update({
      where: { id: params.id },
      data,
      include: { project: { select: { id: true, name: true } } },
    })

    if (data.signedBy && !existing.signedBy) {
      prisma.activity.create({
        data: {
          projectId: doc.projectId,
          actorName: actorName(auth),
          actorType: 'human',
          action: `signed off ${doc.type === 'rams' ? 'RAMS' : doc.type.replace('_', ' ')}: ${doc.title}`,
          iconType: 'check',
        },
      }).catch(() => {})
    }
    return NextResponse.json(doc)
  } catch (error) {
    console.error('[rams/:id] PATCH failed:', error)
    return NextResponse.json({ error: 'Failed to update RAMS doc' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const doc = await prisma.rams.findUnique({ where: { id: params.id } })
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.rams.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[rams/:id] DELETE failed:', error)
    return NextResponse.json({ error: 'Failed to delete RAMS doc' }, { status: 500 })
  }
}
