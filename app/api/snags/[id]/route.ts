import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'
import { runWithOrg } from '@/lib/tenancy'
import { authorizeUploadReference } from '@/lib/upload-provenance'
import controls from '@/lib/field-controls'
import qualityCloseout from '@/lib/quality-closeout'

export const dynamic = 'force-dynamic'
const ALLOWED_STATUS = new Set(['open', 'in_progress', 'closed'])
const ALLOWED_PRIORITY = new Set(['low', 'medium', 'high', 'critical'])
const { snagCloseoutReadiness } = qualityCloseout
type RouteParams = { params: Promise<{ id: string }> }

async function scope<T>(auth: Exclude<Awaited<ReturnType<typeof requireOrg>>, NextResponse>, fn: () => Promise<T>) {
  return runWithOrg({ organizationId: auth.orgId, userId: auth.userId ?? null, role: auth.role }, fn)
}

export async function GET(_req: NextRequest, { params: paramsP }: RouteParams) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const params = await paramsP
  return scope(auth, async () => {
    const snag = await prisma.snag.findUnique({ where: { id: params.id }, include: { project: { select: { id: true, name: true } } } })
    if (!snag) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ snag })
  })
}

export async function PUT(req: NextRequest, { params: paramsP }: RouteParams) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited
  const params = await paramsP
  return scope(auth, async () => {
    try {
      const body = await req.json()
      const existing = await prisma.snag.findUnique({ where: { id: params.id }, select: { status: true, projectId: true, title: true, photoUrl: true, resolution: true, closeoutEvidence: true, closedAt: true, closedBy: true, closeoutVerifiedAt: true } })
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const nextStatus = body.status !== undefined ? (ALLOWED_STATUS.has(body.status) ? body.status : existing.status) : existing.status
      const justClosed = existing.status !== 'closed' && nextStatus === 'closed'
      const reopened = existing.status === 'closed' && nextStatus !== 'closed'
      const resolution = body.resolution !== undefined ? controls.cleanText(body.resolution, 2000) : (existing.resolution || '')
      const closeoutEvidence = body.closeoutEvidence && typeof body.closeoutEvidence === 'object'
        ? controls.sanitizeEvidence(body.closeoutEvidence)
        : controls.sanitizeEvidence(existing.closeoutEvidence)
      if (body.closeoutEvidence !== undefined) {
        const evidenceUrls = [...closeoutEvidence.photoUrls, closeoutEvidence.signatureUrl].filter(Boolean)
        for (const evidenceUrl of evidenceUrls) {
          const uploadError = await authorizeUploadReference(evidenceUrl)
          if (uploadError) return uploadError
        }
      }
      if (justClosed) {
        const readiness = snagCloseoutReadiness({ resolution, closeoutEvidence })
        if (!readiness.ready) return NextResponse.json({ error: 'Snag is not ready for closeout', missing: readiness.missing }, { status: 409 })
      }
      let dueDateUpdate: { dueDate: Date | null } | Record<string, never> = {}
      if (body.dueDate !== undefined) {
        if (body.dueDate) {
          const d = new Date(body.dueDate)
          if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid dueDate' }, { status: 400 })
          dueDateUpdate = { dueDate: d }
        } else dueDateUpdate = { dueDate: null }
      }
      if (body.title !== undefined && !String(body.title).trim()) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
      if (body.photoUrl !== undefined && body.photoUrl && body.photoUrl !== existing.photoUrl) {
        const uploadError = await authorizeUploadReference(body.photoUrl, { userId: auth.userId, personaRole: auth.personaRole })
        if (uploadError) return uploadError
      }
      const snag = await prisma.snag.update({
        where: { id: params.id },
        data: {
          ...(body.title !== undefined && { title: String(body.title).trim() }),
          ...(body.description !== undefined && { description: body.description?.toString().trim() || null }),
          ...(body.location !== undefined && { location: body.location?.toString().trim() || null }),
          ...(body.priority !== undefined && ALLOWED_PRIORITY.has(body.priority) && { priority: body.priority }),
          ...(body.status !== undefined && { status: nextStatus }),
          ...(body.photoUrl !== undefined && { photoUrl: body.photoUrl || null }),
          ...(body.resolution !== undefined && { resolution: resolution || null }),
          ...(body.closeoutEvidence !== undefined && { closeoutEvidence: closeoutEvidence as unknown as object }),
          ...dueDateUpdate,
          closedAt: justClosed ? new Date() : reopened ? null : undefined,
          closedBy: justClosed ? actorName(auth.session) : reopened ? null : undefined,
          closeoutVerifiedAt: justClosed ? new Date() : reopened ? null : undefined,
        },
        include: { project: { select: { id: true, name: true } } },
      })
      if (justClosed || reopened) {
        prisma.activity.create({
          data: { projectId: snag.projectId, actorName: actorName(auth.session), actorType: 'human', action: justClosed ? `closed snag: ${snag.title}` : `reopened snag: ${snag.title}`, detail: justClosed ? resolution : undefined, iconType: 'alert' },
        }).catch(() => {})
      }
      return NextResponse.json(snag)
    } catch (error) {
      reportError(error)
      return NextResponse.json({ error: 'Failed to update snag' }, { status: 500 })
    }
  })
}

export async function DELETE(req: NextRequest, { params: paramsP }: RouteParams) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const params = await paramsP
  return scope(auth, async () => {
    try {
      const snag = await prisma.snag.findUnique({ where: { id: params.id }, select: { projectId: true, title: true, status: true, closeoutVerifiedAt: true } })
      if (!snag) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (snag.status === 'closed' || snag.closeoutVerifiedAt) return NextResponse.json({ error: 'Closed snags are retained for audit; reopen before editing rather than deleting the closeout record' }, { status: 409 })
      await prisma.snag.delete({ where: { id: params.id } })
      auditLog({ action: 'snag.delete', resourceType: 'Snag', resourceId: params.id, ...requestMeta(req) })
      prisma.activity.create({
        data: { projectId: snag.projectId, actorName: actorName(auth.session), actorType: 'human', action: `deleted snag: ${snag.title}`, iconType: 'trash' },
      }).catch(() => {})
      return NextResponse.json({ success: true })
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2003') return NextResponse.json({ error: 'This defect has retained evidence links. Keep the source record and close it when resolved.' }, { status: 409 })
      reportError(error)
      return NextResponse.json({ error: 'Failed to delete snag' }, { status: 500 })
    }
  })
}
