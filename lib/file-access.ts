import type { Prisma } from '@prisma/client'
import { programmeProjectScope, type ProgrammeActor } from './programme-access'

/** Company-wide files remain readable to internal members; project files
 * follow the same assignment rules as drawing metadata. */
export function fileProjectScope(session: ProgrammeActor): { OR: Array<{ projectId: null } | { project: { is: Prisma.ProjectWhereInput } }> } {
  if (session.user?.role === 'client') return { OR: [{ project: { is: { id: '__no_internal_file__' } } }] }
  return { OR: [{ projectId: null }, { project: { is: programmeProjectScope(session) } }] }
}

export function canManageCompanywideFiles(session: ProgrammeActor): boolean {
  return session.user?.role === 'company_admin'
}
