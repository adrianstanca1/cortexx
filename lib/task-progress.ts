import type { prisma } from './db'

type TaskProgressTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/**
 * Task completion is a fallback only: an existing programme owns project
 * progress. Recalculate every affected project from one grouped read so bulk
 * task operations don't degrade into N×2 count queries.
 */
export async function syncTaskProjectProgress(
  tx: TaskProgressTransaction,
  projectIds: Array<string | null>,
  organizationId: string | null,
) {
  if (!organizationId) throw new Error('Organisation context required for task progress')
  const ids = Array.from(new Set(projectIds.filter((id): id is string => Boolean(id))))
  if (ids.length === 0) return

  const counts = await tx.task.groupBy({
    by: ['projectId', 'status'],
    where: { projectId: { in: ids }, organizationId },
    _count: { _all: true },
  })
  const totals = new Map<string, { total: number; done: number }>()
  for (const row of counts) {
    if (!row.projectId) continue
    const current = totals.get(row.projectId) || { total: 0, done: 0 }
    current.total += row._count._all
    if (row.status === 'done') current.done += row._count._all
    totals.set(row.projectId, current)
  }

  await Promise.all(ids.map(projectId => {
    const current = totals.get(projectId) || { total: 0, done: 0 }
    const progress = current.total ? Math.round(current.done / current.total * 100) : 0
    // Check programme ownership and tenant scope in the write itself, not only
    // in an earlier read.
    return tx.project.updateMany({
      where: { id: projectId, organizationId, programmeActivities: { none: {} } },
      data: { progress },
    })
  }))
}
