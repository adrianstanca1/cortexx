/** Shared capability model for the CortexBuild construction OS. */

export const CORTEX_ROLES = [
  'super_admin', 'platform_admin', 'company_admin', 'project_manager', 'foreman', 'operative', 'client',
] as const;
export type CortexRole = typeof CORTEX_ROLES[number];

export const CAPABILITIES = [
  'workspace.read', 'workspace.manage', 'workspace.billing', 'workspace.members',
  'project.read', 'project.create', 'project.manage',
  'task.read', 'task.create', 'task.assign', 'task.approve',
  'time.read', 'time.clock', 'time.approve',
  'procurement.read', 'procurement.create', 'procurement.approve',
  'finance.read', 'finance.create', 'finance.approve',
  'documents.read', 'documents.create', 'documents.approve',
  'drawings.read', 'drawings.annotate', 'drawings.approve',
  'safety.read', 'safety.create', 'safety.approve',
  'quality.read', 'quality.create', 'quality.approve',
  'client.read', 'client.communicate', 'client.approve',
  'ai.use', 'ai.execute', 'ai.approve', 'audit.read',
] as const;
export type Capability = typeof CAPABILITIES[number];

const ALL = new Set<Capability>(CAPABILITIES);
const ROLE_CAPABILITIES: Record<CortexRole, ReadonlySet<Capability>> = {
  super_admin: ALL,
  platform_admin: new Set(CAPABILITIES.filter((c) => !c.startsWith('client.'))),
  company_admin: new Set(CAPABILITIES),
  project_manager: new Set([
    'workspace.read', 'project.read', 'project.manage',
    'task.read', 'task.create', 'task.assign', 'task.approve',
    'time.read', 'time.approve', 'procurement.read', 'procurement.create',
    'finance.read', 'documents.read', 'documents.create', 'documents.approve',
    'drawings.read', 'drawings.annotate', 'safety.read', 'safety.create',
    'quality.read', 'quality.create', 'client.read', 'client.communicate',
    'ai.use', 'ai.execute', 'ai.approve', 'audit.read',
  ]),
  foreman: new Set([
    'workspace.read', 'project.read', 'project.manage',
    'task.read', 'task.create', 'task.assign',
    'time.read', 'time.clock', 'documents.read', 'documents.create',
    'drawings.read', 'drawings.annotate', 'safety.read', 'safety.create',
    'quality.read', 'quality.create', 'ai.use', 'ai.execute',
  ]),
  operative: new Set([
    'workspace.read', 'project.read', 'task.read', 'task.create',
    'time.read', 'time.clock', 'documents.read', 'documents.create',
    'drawings.read', 'drawings.annotate', 'safety.read', 'safety.create',
    'quality.read', 'quality.create', 'ai.use',
  ]),
  client: new Set([
    'project.read', 'task.read', 'documents.read', 'drawings.read',
    'quality.read', 'client.read', 'client.communicate', 'client.approve',
  ]),
};

export function hasCapability(role: CortexRole | string, capability: Capability | string): boolean {
  const set = ROLE_CAPABILITIES[role as CortexRole];
  return !!set && ALL.has(capability as Capability) && set.has(capability as Capability);
}

export function capabilitiesFor(role: CortexRole | string): Capability[] {
  const set = ROLE_CAPABILITIES[role as CortexRole];
  return set ? CAPABILITIES.filter((c) => set.has(c)) : [];
}

export function assertCapability(role: CortexRole | string, capability: Capability): void {
  if (!hasCapability(role, capability)) throw new Error(`forbidden:${capability}`);
}
