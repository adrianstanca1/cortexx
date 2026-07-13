import { prisma } from './db'

interface CreateActivityInput {
  projectId?: string | null
  actorName: string
  actorType?: string
  action: string
  detail?: string | null
  iconType?: string
  organizationId?: string | null
}

/**
 * Create an activity record with sensible defaults.
 *
 * Broadcasting to sibling tabs is handled automatically by the
 * `broadcastExtension` attached to the Prisma client in `lib/db.ts`, so every
 * `prisma.activity.create` call — whether through this helper or directly —
 * pushes cross-tab updates without extra boilerplate.
 */
export async function createActivity(input: CreateActivityInput) {
  return prisma.activity.create({
    data: {
      projectId: input.projectId ?? null,
      actorName: input.actorName,
      actorType: input.actorType ?? 'human',
      action: input.action,
      detail: input.detail ?? null,
      iconType: input.iconType ?? 'check',
      ...(input.organizationId !== undefined ? { organizationId: input.organizationId } : {}),
    },
    include: { project: true },
  })
}
