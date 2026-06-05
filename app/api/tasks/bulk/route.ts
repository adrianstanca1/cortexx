import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'

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
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
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

    // Recompute progress for every affected project — single grouped
    // read instead of N findManys, then per-project update. The prior
    // version did N×(findMany + update) serially: ~10ms per project,
    // so a 50-project bulk took 1s+ purely on round-trips. The groupBy
    // returns all the counts in one DB query.
    if (affectedProjectIds.length > 0) {
      const counts = await prisma.task.groupBy({
        by: ['projectId', 'status'],
        where: { projectId: { in: affectedProjectIds } },
        _count: { _all: true },
      })
      const totals = new Map<string, { total: number; done: number }>()
      for (const row of counts) {
        if (!row.projectId) continue
        const cur = totals.get(row.projectId) || { total: 0, done: 0 }
        cur.total += row._count._all
        if (row.status === 'done') cur.done += row._count._all
        totals.set(row.projectId, cur)
      }
      await Promise.all(
        Array.from(totals.entries()).map(([projectId, { total, done }]) => {
          const progress = total > 0 ? Math.round((done / total) * 100) : 0
          return prisma.project.update({ where: { id: projectId }, data: { progress } })
        }),
      )
      // Projects that had all their tasks deleted disappear from `counts` — zero them out.
      const updated = new Set(totals.keys())
      const zeroed = affectedProjectIds.filter(id => !updated.has(id))
      if (zeroed.length > 0) {
        await prisma.project.updateMany({
          where: { id: { in: zeroed } },
          data: { progress: 0 },
        })
      }
    }

    return NextResponse.json({ updated, affectedProjectIds })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Bulk operation failed' }, { status: 500 })
  }
}
