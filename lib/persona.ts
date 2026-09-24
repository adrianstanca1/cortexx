export const CONSTRUCTION_PERSONAS = [
  'super_admin',
  'platform_admin',
  'company_admin',
  'project_manager',
  'foreman',
  'operative',
  'client',
] as const

export const ASSIGNABLE_PERSONAS = [
  'company_admin',
  'project_manager',
  'foreman',
  'operative',
  'client',
] as const

export type ConstructionPersona = typeof CONSTRUCTION_PERSONAS[number]
export type AssignablePersona = typeof ASSIGNABLE_PERSONAS[number]

const PERSONAS = new Set<string>(CONSTRUCTION_PERSONAS)
const ASSIGNABLE = new Set<string>(ASSIGNABLE_PERSONAS)

export function isConstructionPersona(value: unknown): value is ConstructionPersona {
  return typeof value === 'string' && PERSONAS.has(value)
}

export function isAssignablePersona(value: unknown): value is AssignablePersona {
  return typeof value === 'string' && ASSIGNABLE.has(value)
}

export function resolvePersona(personaRole: unknown, legacyRole?: unknown, orgRole?: unknown): ConstructionPersona {
  if (isConstructionPersona(personaRole)) return personaRole
  if (isConstructionPersona(legacyRole)) return legacyRole
  if (legacyRole === 'admin' || orgRole === 'owner' || orgRole === 'admin') return 'company_admin'
  return 'operative'
}

export function personaLabel(role: string): string {
  return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}
