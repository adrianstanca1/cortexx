import type { Prisma } from '@prisma/client'
import { canManage } from './rbac'

/** One visibility predicate shared by task lists and per-task endpoints.
 * Both callers also execute under the active organization tenancy context.
 * A project manager/foreman sees tasks in their assigned projects AND tasks
 * individually assigned to them, matching the field mobile work queue. */
export function taskVisibilityWhere(
  orgRole: string | null | undefined,
  personaRole: string | null | undefined,
  email: string | null | undefined,
): Prisma.TaskWhereInput {
  if (canManage(orgRole || '')) return {}
  const mail = email?.trim()
  if (personaRole === 'project_manager' || personaRole === 'foreman') {
    if (!mail) return { id: '__no_assigned_task__' }
    const byEmail = { email: { equals: mail, mode: 'insensitive' as const } }
    return { OR: [
      { project: { assignments: { some: { member: byEmail } } } },
      { assignee: byEmail },
    ] }
  }
  if (personaRole === 'operative') {
    if (!mail) return { id: '__no_assigned_task__' }
    return { assignee: { email: { equals: mail, mode: 'insensitive' } } }
  }
  return {}
}

export function visibleTaskById(
  id: string,
  orgRole: string | null | undefined,
  personaRole: string | null | undefined,
  email: string | null | undefined,
): Prisma.TaskWhereInput {
  return { id, ...taskVisibilityWhere(orgRole, personaRole, email) }
}
