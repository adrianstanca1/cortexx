import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { getCurrentOrg } from '@/lib/tenancy'
import { syncTaskProjectProgress } from '@/lib/task-progress'

export const dynamic = 'force-dynamic'

/**
 * Bulk task operations
 *
 * Body shape:
 *   { action: 'complete' | 'reopen' | 'delete', ids: string[] }
 *
 * Returns: { updated: number, affectedProjectIds: string[] }
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (limited) return limited
  // requireAuth() threads the active org into the request-scoped context rather
  // than the session, so read the org id from there before any progress write.
  const orgId = getCurrentOrg()?.organizationId
  if (!orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })

  try {
    const body = await req.json()
    const action = String(body.action || '')
    const ids: string[] = Array.isArray(body.ids)
      ? body.ids.filter((x: unknown) => typeof x === 'string').slice(0, 200)
      : []

    if (!['complete', 'reopen', 'delete'].includes(action)) {
      return NextResponse.json({ error: 'action must be complete | reopen | delete' }, { status: 400 })
    }
    if (ids.length === 0) {
      return NextResponse.json({ error: 'No task ids provided' }, { status: 400 })
    }

    const result = await prisma.$transaction(async tx => {
      // Capture project ownership before delete/move-style mutations so progress
      // can be recomputed even when the selected tasks disappear.
      const tasks = await tx.task.findMany({
        where: { id: { in: ids } },
        select: { id: true, projectId: true },
      })
      const affectedProjectIds = Array.from(
        new Set(tasks.map(task => task.projectId).filter((projectId): projectId is string => Boolean(projectId))),
      )

      let updated = 0
      if (action === 'delete') {
        updated = (await tx.task.deleteMany({ where: { id: { in: ids } } })).count
      } else {
        const status = action === 'complete' ? 'done' : 'todo'
        updated = (await tx.task.updateMany({
          where: { id: { in: ids } },
          data: { status },
        })).count
      }

      await syncTaskProjectProgress(tx, affectedProjectIds, orgId)
      return { updated, affectedProjectIds }
    })

    if (action === 'delete') {
      prisma.activity.create({
        data: {
          projectId: null,
          actorName: actorName(auth),
          actorType: 'human',
          action: `deleted ${result.updated} task${result.updated === 1 ? '' : 's'}`,
          iconType: 'check',
        },
      }).catch(() => {})
    }

    return NextResponse.json(result)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Bulk operation failed' }, { status: 500 })
  }
}
