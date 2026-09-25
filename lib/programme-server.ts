import programme from './programme'

const { daysBetween } = programme

type Tx = {
  programmeActivity: { findMany(args: any): Promise<Array<{ plannedStart: Date; plannedEnd: Date; progress: number }>> }
  project: { update(args: any): Promise<any> }
}

export async function syncProjectProgrammeProgress(tx: Tx, projectId: string, organizationId: string) {
  const activities = await tx.programmeActivity.findMany({
    where: { projectId, organizationId },
    select: { plannedStart: true, plannedEnd: true, progress: true },
  })
  if (!activities.length) return null
  let weight = 0
  let earned = 0
  for (const activity of activities) {
    const duration = daysBetween(activity.plannedStart, activity.plannedEnd)
    weight += duration
    earned += duration * Math.max(0, Math.min(100, activity.progress || 0))
  }
  const progress = weight ? Math.round(earned / weight) : 0
  await tx.project.update({ where: { id: projectId, organizationId }, data: { progress } })
  return progress
}
