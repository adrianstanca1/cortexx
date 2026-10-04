import type { prisma } from './db'

type TaskProgressTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/** Task completion is a fallback only: an existing programme owns project progress. */
export async function syncTaskProjectProgress(tx: TaskProgressTransaction, projectIds: Array<string | null>, organizationId: string | null) {
  if (!organizationId) throw new Error('Organisation context required for task progress')
  for (const projectId of new Set(projectIds.filter((id): id is string => Boolean(id)))) {
    const where = { projectId, AND: [{ organizationId }] }
    const total = await tx.task.count({ where })
    const done = await tx.task.count({ where: { ...where, status: 'done' } })
    // Check programme ownership in the write itself, not only in an earlier read.
    await tx.project.updateMany({
      where: { id: projectId, AND: [{ organizationId }], programmeActivities: { none: {} } },
      data: { progress: total ? Math.round(done / total * 100) : 0 },
    })
  }
}
