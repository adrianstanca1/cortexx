import { Prisma } from '@prisma/client'
import { canManage } from './rbac'
import { getCurrentOrg } from './tenancy'

export type ProgrammeActor = { user?: { email?: string | null; role?: string } }

export function programmeProjectWhere(projectId: string, auth: ProgrammeActor): Prisma.ProjectWhereInput {
  const role = auth.user?.role || ''
  const email = auth.user?.email?.trim() || ''
  if (role === 'client') return { id: '__no_assigned_project__' }
  if (!['project_manager', 'foreman', 'operative'].includes(role)) return { id: projectId }
  if (!email) return { id: '__no_assigned_project__' }
  return {
    id: projectId,
    assignments: { some: { member: { email: { equals: email, mode: 'insensitive' } } } },
  }
}

export function canPlanProgramme(auth: ProgrammeActor): boolean {
  const orgRole = getCurrentOrg()?.role
  return (!!orgRole && canManage(orgRole)) || auth.user?.role === 'project_manager'
}

export function canUpdateProgrammeProgress(auth: ProgrammeActor): boolean {
  return canPlanProgramme(auth) || auth.user?.role === 'foreman'
}
