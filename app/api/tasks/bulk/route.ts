import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { syncTaskProjectProgress } from '@/lib/task-progress'
import { canManage, canWrite } from '@/lib/rbac'

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
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  if (!canWrite(auth.role || '')) return NextResponse.json({ error: 'Write permission required' }, { status: 403 })

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

    const appRole = (auth.session.user as { role?: string })?.role || ''
    const email = (auth.session.user as { email?: string | null })?.email?.trim() || ''
    if (action === 'delete' && !canManage(auth.role || '') && appRole !== 'project_manager') {
      return NextResponse.json({ error: 'Company Admin or Project Manager permission required to delete tasks' }, { status: 403 })
    }

    const access: Prisma.TaskWhereInput = {
      id: { in: ids },
      AND: [{ organizationId: auth.orgId }],
      ...(!canManage(auth.role || '') && (appRole === 'project_manager' || appRole === 'foreman')
        ? (email
          ? { project: { assignments: { some: { member: { email: { equals: email, mode: 'insensitive' } } } } } }
          : { id: '__no_accessible_task__' })
        : {}),
      ...(!canManage(auth.role || '') && appRole === 'operative'
        ? (email
          ? { assignee: { email: { equals: email, mode: 'insensitive' } } }
          : { id: '__no_accessible_task__' })
        : {}),
    }

    const result = await prisma.$transaction(async tx => {
      const tasks = await tx.task.findMany({
        where: access,
        select: { id: true, projectId: true },
      })
      const accessibleIds = tasks.map(task => task.id)
      const affectedProjectIds = Array.from(
        new Set(tasks.map(task => task.projectId).filter((projectId): projectId is string => Boolean(projectId))),
      )

      let updated = 0
      if (accessibleIds.length > 0) {
        const mutationWhere: Prisma.TaskWhereInput = {
          id: { in: accessibleIds },
          AND: [{ organizationId: auth.orgId }],
        }
        if (action === 'delete') {
          updated = (await tx.task.deleteMany({ where: mutationWhere })).count
        } else {
          const status = action === 'complete' ? 'done' : 'todo'
          updated = (await tx.task.updateMany({
            where: mutationWhere,
            data: { status },
          })).count
        }
      }

      await syncTaskProjectProgress(tx, affectedProjectIds, auth.orgId)
      return { updated, affectedProjectIds }
    })

    if (action === 'delete') {
      prisma.activity.create({
        data: {
          projectId: null,
          actorName: actorName(auth.session),
          actorType: 'human',
          action: 'deleted ' + result.updated + ' task' + (result.updated === 1 ? '' : 's'),
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
