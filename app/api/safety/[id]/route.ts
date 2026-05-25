import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const INCIDENT_TYPES = ['near_miss', 'first_aid', 'accident', 'dangerous_occurrence', 'environmental', 'security'] as const
const SEVERITIES = ['near_miss', 'low', 'medium', 'high', 'critical'] as const
const STATUSES = ['open', 'investigating', 'closed'] as const

export async function GET(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const incident = await prisma.safetyIncident.findUnique({
      where: { id: params.id },
      include: { project: { select: { id: true, name: true } } },
    })
    if (!incident) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(incident)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch incident' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const data: Record<string, unknown> = {}

    if (body.title !== undefined) {
      const title = String(body.title).trim()
      if (!title) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
      if (title.length > 200) return NextResponse.json({ error: 'Title too long (max 200)' }, { status: 400 })
      data.title = title
    }
    if (body.description !== undefined) data.description = body.description?.trim() || null
    if (body.type !== undefined && (INCIDENT_TYPES as readonly string[]).includes(body.type)) data.type = body.type
    if (body.severity !== undefined && (SEVERITIES as readonly string[]).includes(body.severity)) data.severity = body.severity
    if (body.location !== undefined) data.location = body.location?.trim() || null
    if (body.reportedBy !== undefined) data.reportedBy = body.reportedBy?.trim() || null
    if (body.injuredParty !== undefined) data.injuredParty = body.injuredParty?.trim() || null
    if (body.photoUrl !== undefined) data.photoUrl = body.photoUrl?.trim() || null
    if (body.notes !== undefined) data.notes = body.notes?.trim() || null
    if (body.riddorReportable !== undefined) data.riddorReportable = !!body.riddorReportable
    if (body.projectId !== undefined) data.projectId = body.projectId || null

    if (body.status !== undefined && (STATUSES as readonly string[]).includes(body.status)) {
      data.status = body.status
      const existing = await prisma.safetyIncident.findUnique({ where: { id: params.id }, select: { status: true, closedAt: true } })
      if (existing) {
        if (body.status === 'closed' && existing.status !== 'closed') data.closedAt = new Date()
        if (body.status !== 'closed' && existing.status === 'closed') data.closedAt = null
      }
    }

    const incident = await prisma.safetyIncident.update({
      where: { id: params.id },
      data,
      include: { project: { select: { id: true, name: true } } },
    })

    if (data.status === 'closed') {
      prisma.activity.create({
        data: {
          projectId: incident.projectId,
          actorName: actorName(auth),
          actorType: 'human',
          action: `closed safety incident: ${incident.title}`,
          iconType: 'check',
        },
      }).catch(() => {})
    }

    return NextResponse.json(incident)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update incident' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const existing = await prisma.safetyIncident.findUnique({ where: { id: params.id }, select: { title: true, projectId: true } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.safetyIncident.delete({ where: { id: params.id } })
    auditLog({
      action: 'safetyIncident.delete',
      resourceType: 'SafetyIncident',
      resourceId: params.id,
      ...requestMeta(req),
    })
    prisma.activity.create({
      data: {
        projectId: existing.projectId,
        actorName: actorName(auth),
        actorType: 'human',
        action: `deleted safety incident: ${existing.title}`,
        iconType: 'trash',
      },
    }).catch(() => {})
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete incident' }, { status: 500 })
  }
}
