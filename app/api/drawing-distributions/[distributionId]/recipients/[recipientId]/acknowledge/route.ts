import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params: paramsP }: { params: Promise<{ distributionId: string; recipientId: string }> }) {
  const { distributionId, recipientId } = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const email = String(auth.session.user?.email || '').trim().toLowerCase()
  try {
    const recipient = await prisma.drawingDistributionRecipient.findFirst({
      where: { id: recipientId, distributionId },
      include: { distribution: { include: { revision: { include: { drawing: { select: { id: true, projectId: true, number: true } } } } } } },
    })
    if (!recipient) return NextResponse.json({ error: 'Distribution recipient not found' }, { status: 404 })
    const canAcknowledgeForOthers = ['company_admin', 'project_manager'].includes(auth.personaRole || '')
    if (recipient.email.toLowerCase() !== email && !canAcknowledgeForOthers) return NextResponse.json({ error: 'You can only acknowledge revisions issued to you' }, { status: 403 })
    if (recipient.acknowledgedAt) return NextResponse.json(recipient)

    const updated = await prisma.drawingDistributionRecipient.update({ where: { id: recipient.id }, data: { acknowledgedAt: new Date(), acknowledgedBy: email || auth.userId || 'user' } })
    auditLog({ action: 'drawing.distribution.acknowledge', resourceType: 'DrawingDistributionRecipient', resourceId: recipient.id, metadata: { distributionId, drawingId: recipient.distribution.revision.drawing.id, revisionId: recipient.distribution.revisionId, recipientEmail: recipient.email }, ...requestMeta(req) })
    prisma.activity.create({ data: { projectId: recipient.distribution.revision.drawing.projectId, actorName: auth.session.user?.name || auth.session.user?.email || 'User', actorType: 'human', action: `acknowledged ${recipient.distribution.revision.drawing.number} rev ${recipient.distribution.revision.revision}`, iconType: 'check' } }).catch(() => {})
    return NextResponse.json(updated)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to acknowledge drawing revision' }, { status: 500 })
  }
}
