// ═══════════════════════════════════════════════════════════════════════════════
// Shared Constants — Platform-wide
// ═══════════════════════════════════════════════════════════════════════════════

export const APP_NAME = 'CortexBuild Pro';
export const APP_VERSION = '2.0.0';
export const ORG_NAME = 'CortexBuild Ltd.';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const ROLES_HIERARCHY: Record<string,number> = {
  viewer: 0, worker: 1, field_worker: 2, supervisor: 3,
  manager: 4, project_manager: 5, company_admin: 6,
  company_owner: 7, admin: 8, super_admin: 9
};

export const PERMISSION_MODULES = [
  'projects','tasks','safety','inspections','defects','team',
  'documents','equipment','reports','settings','billing','integrations','ai'
] as const;

export const PERMISSION_ACTIONS = ['view','create','edit','delete','approve','export'] as const;

export const SAFETY_SEVERITY_COLORS = {
  near_miss: '#94a3b8', low: '#eab308', medium: '#f97316',
  high: '#ef4444', critical: '#7f1d1d'
};

export const PROJECT_STATUS_COLORS = {
  planning: '#94a3b8', active: '#22c55e', on_hold: '#f97316',
  completed: '#3b82f6', cancelled: '#ef4444'
};

export const TASK_PRIORITY_COLORS = {
  low: '#94a3b8', medium: '#3b82f6', high: '#f97316', critical: '#ef4444'
};

export const INSPECTION_STATUS_COLORS = {
  pending: '#f97316', passed: '#22c55e', failed: '#ef4444', in_progress: '#3b82f6'
};

// AI Agents
export const AI_AGENTS = [
  { id: 'construction',   name: 'Construction Domain',   icon: '🏗️', description: 'Building codes, materials, structural' },
  { id: 'safety',         name: 'Safety Compliance',     icon: '🛡️', description: 'OSHA/HSE regulations, hazard analysis, PPE' },
  { id: 'cost',           name: 'Cost Estimation',       icon: '💰', description: 'Unit costs, labour rates, budgeting' },
  { id: 'project',        name: 'Project Coordinator',   icon: '📋', description: 'Scheduling, critical path, milestones' },
  { id: 'contracts',      name: 'Contracts Lawyer',      icon: '⚖️', description: 'JCT/NEC, payment terms, warranties' },
  { id: 'defects',        name: 'Quality Control',       icon: '✅', description: 'Snagging, punch lists, NCR' },
  { id: 'valuations',     name: 'Valuations',            icon: '📊', description: 'Interim certs, cash flow, PC sums' },
  { id: 'team',           name: 'Team Management',       icon: '👷', description: 'CPCS, SSSTS, workforce allocation' },
  { id: 'carbon',         name: 'Carbon Advisor',        icon: '🌱', description: 'Embodied carbon, EPD, sustainability' },
  { id: 'bim',            name: 'BIM Specialist',        icon: '🏢', description: 'Clash detection, model viewing, 4D' },
] as const;

// Subscription plans
export const SUBSCRIPTION_PLANS = {
  free:     { name: 'Free',       maxUsers: 3,  maxProjects: 2,  features: ['projects','tasks','safety'] },
  starter:  { name: 'Starter',    maxUsers: 10, maxProjects: 5,  features: ['projects','tasks','safety','inspections','team','documents'] },
  growth:   { name: 'Growth',     maxUsers: 50, maxProjects: 20, features: ['projects','tasks','safety','inspections','defects','team','equipment','rfi','documents','ai-basic','reports'] },
  enterprise: { name: 'Enterprise', maxUsers: 999, maxProjects: 999, features: ['*'] },
};
