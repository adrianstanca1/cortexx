import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const PURPOSES = new Set(['For information', 'For construction', 'For approval', 'For review', 'As built'])

export async function GET(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const { id } = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const drawing = await prisma.drawing.findUnique({ where: { id }, select: { id: true } })
  if (!drawing) return NextResponse.json({ error: 'Drawing not found' }, { status: 404 })
  const distributions = await prisma.drawingDistribution.findMany({
    where: { drawingId: id },
    include: { revision: { select: { id: true, revision: true, fileUrl: true, fileName: true } }, recipients: { orderBy: { email: 'asc' } } },
    orderBy: { issuedAt: 'desc' },
  })
  return NextResponse.json({ distributions })
}

export async function POST(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const { id } = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!['company_admin', 'project_manager'].includes(auth.personaRole || '')) {
    return NextResponse.json({ error: 'Company Admin or Project Manager permission required' }, { status: 403 })
  }
  try {
    const body = await req.json()
    const revisionId = String(body.revisionId || '').trim()
    const purpose = PURPOSES.has(body.purpose) ? body.purpose : 'For information'
    const rawRecipients = Array.isArray(body.recipients) ? body.recipients : []
    const recipients = [...new Map<string, { email: string; name: string | null }>(rawRecipients.map((item: unknown): [string, { email: string; name: string | null }] => {
      const row = item && typeof item === 'object' ? item as { email?: unknown; name?: unknown } : {}
      const email = String(row.email || '').trim().toLowerCase()
      const name = String(row.name || '').trim() || null
      return [email, { email, name }]
    })).values()].filter(r => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email))
    if (!revisionId) return NextResponse.json({ error: 'Revision is required' }, { status: 400 })
    if (!recipients.length) return NextResponse.json({ error: 'At least one valid recipient email is required' }, { status: 400 })
    if (recipients.length > 100) return NextResponse.json({ error: 'Maximum 100 recipients per distribution' }, { status: 400 })

    const revision = await prisma.drawingRevision.findFirst({ where: { id: revisionId, drawingId: id }, include: { drawing: { select: { projectId: true, number: true, title: true } } } })
    if (!revision) return NextResponse.json({ error: 'Revision is not part of this drawing' }, { status: 400 })

    const distribution = await prisma.drawingDistribution.create({
      data: {
        drawingId: id,
        revisionId,
        purpose,
        message: String(body.message || '').trim().slice(0, 2000) || null,
        issuedByUserId: auth.userId || null,
        recipients: { create: recipients.map(recipient => ({ ...recipient, organizationId: auth.orgId })) },
      },
      include: { revision: { select: { id: true, revision: true, fileUrl: true, fileName: true } }, recipients: { orderBy: { email: 'asc' } } },
    })
    auditLog({ action: 'drawing.distribution.issue', resourceType: 'DrawingDistribution', resourceId: distribution.id, metadata: { drawingId: id, revisionId, revision: revision.revision, purpose, recipients: recipients.map(r => r.email) }, ...requestMeta(req) })
    prisma.activity.create({ data: { projectId: revision.drawing.projectId, actorName: auth.session.user?.name || auth.session.user?.email || 'User', actorType: 'human', action: `issued ${revision.drawing.number} rev ${revision.revision} to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}`, iconType: 'doc' } }).catch(() => {})
    return NextResponse.json(distribution, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to issue drawing revision' }, { status: 500 })
  }
}
