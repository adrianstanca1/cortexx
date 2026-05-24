import { hasPermission } from './utils';
import type { User, UserRole } from './types';

export type Module = 'projects'|'tasks'|'safety'|'inspections'|'defects'|'team'|'documents'|'equipment'|'reports'|'settings'|'billing'|'integrations'|'ai';
export type Action = 'view'|'create'|'edit'|'delete'|'approve'|'export';

const MODULE_ACL: Record<string, Record<string, UserRole>> = {
  projects:    { view:'viewer',    create:'project_manager', edit:'supervisor',  delete:'admin',         approve:'project_manager', export:'manager' },
  tasks:         { view:'viewer',    create:'supervisor',     edit:'supervisor',  delete:'manager',        approve:'project_manager', export:'manager' },
  safety:        { view:'viewer',    create:'field_worker',   edit:'supervisor',  delete:'project_manager', approve:'project_manager', export:'manager' },
  inspections:   { view:'viewer',    create:'supervisor',     edit:'supervisor',  delete:'manager',        approve:'project_manager', export:'manager' },
  defects:       { view:'viewer',    create:'field_worker',   edit:'supervisor',  delete:'project_manager', approve:'project_manager', export:'manager' },
  team:          { view:'viewer',    create:'admin',          edit:'admin',       delete:'company_owner',   approve:'company_owner',  export:'admin' },
  documents:     { view:'viewer',    create:'field_worker',   edit:'project_manager', delete:'admin',       approve:'manager',        export:'viewer' },
  equipment:     { view:'viewer',    create:'project_manager', edit:'project_manager', delete:'admin',       approve:'manager',        export:'manager' },
  reports:       { view:'viewer',    create:'project_manager', edit:'project_manager', delete:'admin',       approve:'company_owner', export:'viewer' },
  settings:      { view:'company_admin', create:'company_owner', edit:'company_owner', delete:'super_admin',   approve:'super_admin',  export:'admin' },
  billing:       { view:'company_owner', create:'super_admin', edit:'super_admin', delete:'super_admin',    approve:'super_admin',  export:'super_admin' },
  integrations:  { view:'company_admin', create:'super_admin', edit:'super_admin', delete:'super_admin',    approve:'super_admin',  export:'super_admin' },
  ai:            { view:'field_worker', create:'field_worker', edit:'project_manager', delete:'admin',       approve:'manager',        export:'company_admin' },
};

export function can(user: User, module: Module, action: Action): boolean {
  const minRole = MODULE_ACL[module]?.[action] ?? 'super_admin';
  return hasPermission(user.role, minRole);
}
export function requirePermission(user: User, module: Module, action: Action) {
  if (!can(user, module, action)) throw new Error(`Forbidden: ${user.role} cannot ${action} ${module}`);
}
