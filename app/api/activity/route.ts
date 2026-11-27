import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { createActivity } from '@/lib/activity'
import { withRoute } from '@/lib/withRoute'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 100

// Strip control characters and limit length to prevent storage abuse
function sanitize(s: string, maxLen = 500): string {
  return String(s).replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, maxLen)
}

export async function GET(req: NextRequest) {
  const org = await requireOrg()
  if (org instanceof NextResponse) return org
  const auth = org.session
  try {
    const { searchParams } = new URL(req.url)
    const take = Math.min(parseInt(searchParams.get('take') || '20') || 20, MAX_TAKE)
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0') || 0)
    const projectId = searchParams.get('projectId')
    const actorType = searchParams.get('actorType') // 'human' | 'ai'
    const search = searchParams.get('q')?.trim()

    const where = {
      ...(projectId && { projectId }),
      ...(actorType && { actorType }),
      ...(search && {
        OR: [
          { action: { contains: search, mode: 'insensitive' as const } },
          { detail: { contains: search, mode: 'insensitive' as const } },
          { actorName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        include: { project: true },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.activity.count({ where }),
    ])
    return NextResponse.json({ activities, total, hasMore: skip + activities.length < total })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}

export const POST = withRoute(async ({ req, session, userId, orgId, orgSlug, orgName, role, personaRole }) => {
  const __limited = await enforceRateLimit(req, 'write', (session.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json()
    if (!body.action?.trim()) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 })
    }
    // Source actor from session — never trust client-supplied actorName.
    // The Prisma broadcast extension auto-notifies sibling tabs.
    const activity = await createActivity({
      projectId: body.projectId || null,
      actorName: sanitize(actorName(session), 100),
      actorType: body.actorType === 'ai' ? 'ai' : 'human',
      action: sanitize(body.action, 200),
      detail: body.detail ? sanitize(body.detail) : null,
      iconType: body.iconType || 'check',
    })
    return NextResponse.json(activity, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 })
  }

}, { permission: 'write' })
