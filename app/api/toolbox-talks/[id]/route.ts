import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

function parseDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const d = new Date(v as string); return isNaN(d.getTime()) ? undefined : d
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const existing = await prisma.toolboxTalk.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (typeof body.topic === 'string' && body.topic.trim()) data.topic = body.topic.trim().slice(0, 200)
    if (typeof body.location === 'string') data.location = body.location.slice(0, 200) || null
    if (typeof body.deliveredBy === 'string') data.deliveredBy = body.deliveredBy.slice(0, 100) || null
    if (typeof body.attendees === 'string') {
      data.attendees = body.attendees.slice(0, 4000) || null
      data.attendeeCount = body.attendees.split(/\n/).map((l: string) => l.trim()).filter(Boolean).length
    }
    if (typeof body.attendeeCount === 'number' && isFinite(body.attendeeCount)) {
      data.attendeeCount = Math.max(0, Math.min(500, Math.floor(body.attendeeCount)))
    }
    if (typeof body.hazardsCovered === 'string') data.hazardsCovered = body.hazardsCovered.slice(0, 2000) || null
    if (typeof body.notes === 'string') data.notes = body.notes.slice(0, 2000) || null
    if ('date' in body) {
      const d = parseDate(body.date)
      if (d === undefined && body.date) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
      if (d === null) return NextResponse.json({ error: 'date cannot be cleared' }, { status: 400 })
      data.date = d
    }
    if (typeof body.signedOff === 'boolean') {
      data.signedOff = body.signedOff
      data.signedAt = body.signedOff ? (existing.signedAt || new Date()) : null
    }

    const talk = await prisma.toolboxTalk.update({
      where: { id: params.id },
      data,
      include: { project: { select: { id: true, name: true } } },
    })

    if (data.signedOff === true && !existing.signedOff && talk.projectId) {
      prisma.activity.create({
        data: {
          projectId: talk.projectId,
          actorName: actorName(auth),
          actorType: 'human',
          action: `signed off toolbox talk: ${talk.topic}`,
          iconType: 'check',
        },
      }).catch(() => {})
    }
    return NextResponse.json(talk)
  } catch (error) {
    console.error('[toolbox-talks/:id] PATCH failed:', error)
    return NextResponse.json({ error: 'Failed to update toolbox talk' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const talk = await prisma.toolboxTalk.findUnique({ where: { id: params.id } })
    if (!talk) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.toolboxTalk.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[toolbox-talks/:id] DELETE failed:', error)
    return NextResponse.json({ error: 'Failed to delete toolbox talk' }, { status: 500 })
  }
}
