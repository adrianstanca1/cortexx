import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

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
  const __limited = enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json()
    const action = String(body.action || '')
    const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === 'string').slice(0, 200) : []

    if (!['complete', 'reopen', 'delete'].includes(action)) {
      return NextResponse.json({ error: 'action must be complete | reopen | delete' }, { status: 400 })
    }
    if (ids.length === 0) {
      return NextResponse.json({ error: 'No task ids provided' }, { status: 400 })
    }

    // Get affected project ids before mutation so we can recompute their progress
    const tasks = await prisma.task.findMany({
      where: { id: { in: ids } },
      select: { id: true, projectId: true },
    })
    const affectedProjectIds = Array.from(new Set(tasks.map(t => t.projectId).filter((p): p is string => !!p)))

    let updated = 0
    if (action === 'delete') {
      const res = await prisma.task.deleteMany({ where: { id: { in: ids } } })
      updated = res.count
      prisma.activity.create({
        data: {
          projectId: null,
          actorName: actorName(auth),
          actorType: 'human',
          action: `deleted ${updated} task${updated === 1 ? '' : 's'}`,
          iconType: 'check',
        },
      }).catch(() => {})
    } else {
      const newStatus = action === 'complete' ? 'done' : 'todo'
      const res = await prisma.task.updateMany({
        where: { id: { in: ids } },
        data: { status: newStatus },
      })
      updated = res.count
    }

    // Recalculate progress for each affected project
    for (const projectId of affectedProjectIds) {
      const all = await prisma.task.findMany({ where: { projectId }, select: { status: true } })
      const total = all.length
      const done = all.filter(t => t.status === 'done').length
      const progress = total > 0 ? Math.round((done / total) * 100) : 0
      await prisma.project.update({ where: { id: projectId }, data: { progress } })
    }

    return NextResponse.json({ updated, affectedProjectIds })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Bulk operation failed' }, { status: 500 })
  }
}
