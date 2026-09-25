import { Prisma } from '@prisma/client'
import changeControl from '@/lib/programme-change-control'

const { buildBaselineSnapshot } = changeControl

type Tx = {
  programmeActivity: { findMany(args: any): Promise<any[]>; update(args: any): Promise<any> }
  programmeDependency: { findMany(args: any): Promise<any[]> }
  programmeBaselineRevision: { aggregate(args: any): Promise<any>; updateMany(args: any): Promise<any>; create(args: any): Promise<any> }
}

type CommitBaselineInput = {
  projectId: string
  organizationId: string
  createdByUserId?: string | null
  label?: string | null
  reason: string
  effectiveAt?: Date
}

export async function commitProgrammeBaseline(tx: Tx, input: CommitBaselineInput) {
  const [activities, dependencies, latest] = await Promise.all([
    tx.programmeActivity.findMany({
      where: { projectId: input.projectId, organizationId: input.organizationId },
      orderBy: [{ sortOrder: 'asc' }, { plannedStart: 'asc' }, { createdAt: 'asc' }],
    }),
    tx.programmeDependency.findMany({
      where: { projectId: input.projectId, organizationId: input.organizationId },
      orderBy: { createdAt: 'asc' },
    }),
    tx.programmeBaselineRevision.aggregate({
      where: { projectId: input.projectId, organizationId: input.organizationId },
      _max: { revision: true },
    }),
  ])
  if (activities.length === 0) throw new Error('PROGRAMME_EMPTY')

  const effectiveAt = input.effectiveAt || new Date()
  const snapshot = buildBaselineSnapshot(activities, dependencies, effectiveAt)
  await tx.programmeBaselineRevision.updateMany({
    where: { projectId: input.projectId, organizationId: input.organizationId, status: 'active' },
    data: { status: 'superseded' },
  })
  for (const activity of activities) {
    await tx.programmeActivity.update({
      where: { id: activity.id },
      data: { baselineStart: activity.plannedStart, baselineEnd: activity.plannedEnd },
    })
  }
  return tx.programmeBaselineRevision.create({
    data: {
      projectId: input.projectId,
      revision: (latest._max.revision || 0) + 1,
      label: input.label || null,
      reason: input.reason,
      snapshot: snapshot as Prisma.InputJsonValue,
      status: 'active',
      effectiveAt,
      createdByUserId: input.createdByUserId || null,
      organizationId: input.organizationId,
    },
  })
}
