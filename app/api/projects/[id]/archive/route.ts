import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { withRoute, decodePathSegment } from '@/lib/withRoute'
export const dynamic = 'force-dynamic'

/**
 * POST  → archive (sets archivedAt = now)
 * DELETE → unarchive (sets archivedAt = null)
 */
export const POST = withRoute(async ({ req, session, userId, orgId, orgSlug, orgName, role, personaRole }) => {
  const __segments = req.nextUrl.pathname.split('/').filter(Boolean).map(decodePathSegment)
  const params = { id: __segments[2] }
  const limited = await enforceRateLimit(req, 'write', (session.user as { id?: string }).id)
  if (limited) return limited
  try {
    const project = await prisma.project.update({
      where: { id: params.id },
      data: { archivedAt: new Date() },
    })
    prisma.activity.create({
      data: {
        projectId: project.id,
        actorName: actorName(session),
        actorType: 'human',
        action: `archived project ${project.name}`,
        iconType: 'pin',
      },
    }).catch(() => {})
    return NextResponse.json({ project })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to archive' }, { status: 500 })
  }

}, { permission: 'write' })

export const DELETE = withRoute(async ({ req, session, userId, orgId, orgSlug, orgName, role, personaRole }) => {
  const __segments = req.nextUrl.pathname.split('/').filter(Boolean).map(decodePathSegment)
  const params = { id: __segments[2] }
  try {
    const project = await prisma.project.update({
      where: { id: params.id },
      data: { archivedAt: null },
    })
    prisma.activity.create({
      data: {
        projectId: project.id,
        actorName: actorName(session),
        actorType: 'human',
        action: `unarchived project ${project.name}`,
        iconType: 'pin',
      },
    }).catch(() => {})
    return NextResponse.json({ project })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to unarchive' }, { status: 500 })
  }

}, { permission: 'write' })
