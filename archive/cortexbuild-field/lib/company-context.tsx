import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/contexts/auth-context';
import { buildCompanyPinForUser } from '@/lib/decide-company-after-auth';

// ─── Role Hierarchy ───────────────────────────────────────────────────────────
/**
 * Canonical role taxonomy. Mirrors `companyUsers.companyRole` in the database
 * and what `auth.me` returns. This is the role enum that should drive
 * permission checks via `hasPermission(...)`.
 *
 * Note: a separate, legacy `UserRole` lives in `@/lib/types` for the older
 * mock-data screens (project_manager, field_worker, etc.). Don't confuse the two.
 */
export type UserRole = 'super_admin' | 'company_admin' | 'manager' | 'supervisor' | 'worker' | 'viewer';

export const ROLE_LEVELS: Record<UserRole, number> = {
  super_admin:   100,
  company_admin: 80,
  manager:       60,
  supervisor:    40,
  worker:        20,
  viewer:        10,
};

export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole];
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Company {
  id: number;
  name: string;
  slug: string;
  plan: 'free' | 'business' | 'pro' | 'enterprise';
  logoUrl?: string;
  primaryColor: string;
  utr?: string;
  cisStatus: string;
  vatNumber?: string;
  companyNumber?: string;
  address?: string;
  phone?: string;
  email?: string;
  payrollEmail?: string;
  activeAiProvider: string;
  activeAiModel: string;
  maxProjects: number;
  maxUsers: number;
  maxPipelines: number;
}

export interface CompanyProject {
  id: number;
  name: string;
  reference: string;
  address: string;
  status: string;
  lat?: number;
  lng?: number;
  distanceKm?: number;
}

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string;
  role: UserRole;
  jobTitle?: string;
  department?: string;
}

// ─── Mock Data (fallback when no backend) ────────────────────────────────────
const MOCK_COMPANIES: Company[] = [
  {
    id: 1,
    name: 'CortexBuild Ltd.',
    slug: 'cortexbuild',
    plan: 'pro',
    primaryColor: '#1E3A5F',
    cisStatus: 'registered_20',
    vatNumber: 'GB123456789',
    companyNumber: '12345678',
    address: '1 Construction House, London EC1A 1BB',
    phone: '020 7123 4567',
    email: 'admin@cortexbuild.co.uk',
    payrollEmail: 'payroll@cortexbuild.co.uk',
    activeAiProvider: 'forge',
    activeAiModel: 'default',
    maxProjects: 999,
    maxUsers: 999,
    maxPipelines: 999,
  },
  {
    id: 2,
    name: 'Apex Contractors Ltd.',
    slug: 'apex',
    plan: 'business',
    primaryColor: '#D97706',
    cisStatus: 'gross_payment',
    vatNumber: 'GB987654321',
    companyNumber: '87654321',
    address: '42 Builder Street, Manchester M1 1AB',
    phone: '0161 234 5678',
    email: 'admin@apexcontractors.co.uk',
    activeAiProvider: 'openai',
    activeAiModel: 'gpt-4o',
    maxProjects: 3,
    maxUsers: 25,
    maxPipelines: 3,
  },
];

const MOCK_PROJECTS: CompanyProject[] = [
  { id: 1, name: 'Burnt Mill Academy', reference: 'M24-747', address: 'First Avenue, Harlow ESS CM20 2NR', status: 'active', lat: 51.77, lng: 0.09, distanceKm: 25 },
  { id: 2, name: 'St Georges Hospital', reference: 'M24-742', address: 'Blackshaw Road, Tooting SW17 0QT', status: 'active', lat: 51.43, lng: -0.17, distanceKm: 25 },
  { id: 3, name: 'The Robert Nappier School', reference: 'M25-821', address: 'Third Avenue, Gillingham ME7 2LX', status: 'active', lat: 51.38, lng: 0.54, distanceKm: 37 },
  { id: 4, name: 'Northfields - Thurston Group', reference: 'M25-807', address: 'Unit 18, Nottingham NG14 6QL', status: 'active', lat: 52.95, lng: -1.14, distanceKm: 185 },
];

const GUEST_USER: CurrentUser = {
  id: 0,
  name: 'Guest User',
  email: '',
  role: 'viewer',
};

// ─── Context ──────────────────────────────────────────────────────────────────
interface CompanyContextValue {
  // Current state
  currentCompany: Company | null;
  currentProject: CompanyProject | null;
  currentUser: CurrentUser;
  companies: Company[];
  projects: CompanyProject[];
  isLoading: boolean;

  // Actions
  switchCompany: (company: Company) => Promise<void>;
  switchProject: (project: CompanyProject) => void;
  refreshProjects: () => Promise<void>;

  // Permissions
  can: (requiredRole: UserRole) => boolean;
  isAdmin: boolean;
  isManager: boolean;
  isSuperAdmin: boolean;

  // Plan limits
  planLimits: {
    maxProjects: number;
    maxUsers: number;
    maxPipelines: number;
    canUseAI: boolean;
    canUseCIS: boolean;
    canUseTenders: boolean;
    canUseAdvancedReports: boolean;
  };
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [currentCompany, setCurrentCompany] = useState<Company | null>(MOCK_COMPANIES[0]);
  const [currentProject, setCurrentProject] = useState<CompanyProject | null>(MOCK_PROJECTS[0]);
  const [projects, setProjects] = useState<CompanyProject[]>(MOCK_PROJECTS);
  const [isLoading, setIsLoading] = useState(false);

  // Real list of companies the user belongs to — sourced from
  // `companies.list` (protectedProcedure, scoped to ctx.user.id). When
  // not yet loaded (pre-auth, query in flight, or no membership) we
  // fall back to MOCK_COMPANIES so the UI still has something to render
  // for the brief window. The `enabled: !!user` gate matches the other
  // `companyScopedProcedure` queries below — no requests pre-login.
  const companiesQuery = trpc.companies.list.useQuery(undefined, {
    retry: 1,
    staleTime: 60_000,
    enabled: !!user,
  });
  const companies: Company[] = useMemo(() => {
    const live = companiesQuery.data;
    if (!live || live.length === 0) return MOCK_COMPANIES;
    return live.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      // Drizzle returns `plan` as `string`; the Company type narrows it
      // to a literal union. Trust the server-side enum here — invalid
      // values would already be a deploy-level schema violation.
      plan: (row.plan as Company['plan']) ?? 'free',
      logoUrl: row.logoUrl ?? undefined,
      primaryColor: row.primaryColor ?? '#1E3A5F',
      utr: row.utr ?? undefined,
      cisStatus: row.cisStatus ?? 'not_registered',
      vatNumber: row.vatNumber ?? undefined,
      companyNumber: row.companyNumber ?? undefined,
      address: row.address ?? undefined,
      phone: row.phone ?? undefined,
      email: row.email ?? undefined,
      payrollEmail: row.payrollEmail ?? undefined,
      activeAiProvider: row.activeAiProvider ?? 'forge',
      activeAiModel: row.activeAiModel ?? 'default',
      maxProjects: row.maxProjects ?? 5,
      maxUsers: row.maxUsers ?? 10,
      maxPipelines: row.maxPipelines ?? 1,
    }));
  }, [companiesQuery.data]);
  const currentUser: CurrentUser = useMemo(() => {
    if (!user) return GUEST_USER;
    const membershipRole = user.companyRole as UserRole | undefined;
    const role: UserRole = membershipRole && membershipRole in ROLE_LEVELS
      ? membershipRole
      : user.role === 'admin'
        ? 'super_admin'
        : 'worker';
    return {
      id: user.id,
      name: user.name ?? user.email ?? 'Signed-in user',
      email: user.email ?? '',
      role,
      jobTitle: user.jobTitle ?? undefined,
      department: user.department ?? undefined,
    };
  }, [user]);
  const settingsCompanyId = currentCompany?.id ?? MOCK_COMPANIES[0].id;
  // Gate both queries on `user` so the pre-login screen (and the post-logout
  // window before unmount) doesn't fire `settings.get` / `projects.list` —
  // both run on `companyScopedProcedure` and would 401 without a session,
  // spamming console.error and causing a misleading "API broken" first
  // impression. The queries re-enable automatically when notifyAuthRefresh
  // (login + logout broadcast) re-resolves `user`.
  const settingsQuery = trpc.settings.get.useQuery(
    { companyId: settingsCompanyId },
    { retry: 1, staleTime: 60_000, enabled: !!user },
  );
  const projectsQuery = trpc.projects.list.useQuery(
    { companyId: settingsCompanyId },
    { retry: 1, staleTime: 30_000, enabled: !!user },
  );

  // Reset tenant state when the user logs out so the previous account's
  // company/projects don't bleed into the next sign-in session. The
  // queries are already disabled by `enabled: !!user`, but cached data
  // from the disabled queries remains in TanStack Query — clearing the
  // local state explicitly is what the UI actually reads from.
  useEffect(() => {
    if (user) return;
    setCurrentCompany(MOCK_COMPANIES[0]);
    setCurrentProject(MOCK_PROJECTS[0]);
    setProjects(MOCK_PROJECTS);
  }, [user]);

  // When the user signs in (or signs in as a different user), pin
  // currentCompany to their primary `companyId` so the very first
  // authenticated `settings.get` / `projects.list` query targets the
  // right tenant. The `pinnedForUserIdRef` makes this strictly
  // once-per-user.id-transition: a later `switchCompany()` (including
  // a switch TO the same id as `MOCK_COMPANIES[0]`, which the helper
  // can't otherwise distinguish from "still on the pre-login default")
  // is preserved even if `useAuth()` re-renders the user object.
  const pinnedForUserIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!user?.companyId) {
      // Reset on sign-out so the next sign-in pins fresh. The other
      // logout-reset effect above clears currentCompany itself.
      pinnedForUserIdRef.current = null;
      return;
    }
    if (pinnedForUserIdRef.current === user.id) return;
    pinnedForUserIdRef.current = user.id;
    const pinned = buildCompanyPinForUser(user, MOCK_COMPANIES[0]);
    if (pinned) setCurrentCompany(pinned);
  }, [user]);

  // Restore saved selections
  useEffect(() => {
    AsyncStorage.multiGet(['cb_company_id', 'cb_project_id']).then(([[, cId], [, pId]]) => {
      if (cId) {
        const c = MOCK_COMPANIES.find(c => c.id === parseInt(cId));
        if (c) setCurrentCompany(c);
      }
      if (pId) {
        const p = MOCK_PROJECTS.find(p => p.id === parseInt(pId));
        if (p) setCurrentProject(p);
      }
    });
  }, []);

  useEffect(() => {
    if (!settingsQuery.data) return;
    const company: Company = {
      ...MOCK_COMPANIES[0],
      id: settingsQuery.data.id,
      name: settingsQuery.data.name,
      slug: settingsQuery.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'company',
      phone: settingsQuery.data.phone ?? undefined,
      email: settingsQuery.data.email ?? undefined,
      address: settingsQuery.data.address ?? undefined,
      payrollEmail: settingsQuery.data.payrollEmail ?? undefined,
      utr: settingsQuery.data.utr ?? undefined,
      vatNumber: settingsQuery.data.vatNumber ?? undefined,
      companyNumber: settingsQuery.data.companyNumber ?? undefined,
    };
    setCurrentCompany(company);
  }, [settingsQuery.data]);

  useEffect(() => {
    if (!projectsQuery.data?.length) return;
    const liveProjects: CompanyProject[] = projectsQuery.data.map(project => ({
      id: project.id,
      name: project.name,
      reference: `P-${String(project.id).padStart(4, '0')}`,
      address: project.siteAddress ?? '',
      status: project.status,
      lat: project.siteLat ? Number(project.siteLat) : undefined,
      lng: project.siteLng ? Number(project.siteLng) : undefined,
    }));
    setProjects(liveProjects);
    setCurrentProject(current => {
      if (current && liveProjects.some(project => project.id === current.id)) return current;
      return liveProjects.find(project => project.status === 'active') ?? liveProjects[0] ?? null;
    });
  }, [projectsQuery.data]);

  const switchCompany = useCallback(async (company: Company) => {
    setIsLoading(true);
    setCurrentCompany(company);
    setCurrentProject(null);
    await AsyncStorage.setItem('cb_company_id', String(company.id));
    await AsyncStorage.removeItem('cb_project_id');
    // Don't call projectsQuery.refetch() here — projectsQuery's input now
    // depends on settingsCompanyId (derived from currentCompany), and React
    // batches state updates, so a refetch in this tick would still hit the
    // OLD companyId and load the wrong tenant's projects. React Query
    // automatically fires a fresh request when settingsCompanyId changes on
    // re-render. The effect below clears isLoading once the new query settles.
  }, []);

  // Clear the switching-company spinner once the projects query has settled
  // for the newly-selected company. projectsQuery.isFetching covers both the
  // initial fetch on key change and the refetch path.
  useEffect(() => {
    if (!isLoading) return;
    if (!projectsQuery.isFetching) setIsLoading(false);
  }, [isLoading, projectsQuery.isFetching]);

  const switchProject = useCallback((project: CompanyProject) => {
    setCurrentProject(project);
    AsyncStorage.setItem('cb_project_id', String(project.id));
  }, []);

  const refreshProjects = useCallback(() => {
    return projectsQuery.refetch().catch(() => {
      setProjects([...MOCK_PROJECTS].sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999)));
    }).then(() => undefined);
  }, [projectsQuery]);

  const can = useCallback((requiredRole: UserRole) => {
    return hasPermission(currentUser.role, requiredRole);
  }, [currentUser.role]);

  const planLimits = useMemo(() => {
    const plan = currentCompany?.plan ?? 'free';
    return {
      maxProjects: currentCompany?.maxProjects ?? 5,
      maxUsers: currentCompany?.maxUsers ?? 10,
      maxPipelines: currentCompany?.maxPipelines ?? 1,
      canUseAI: plan !== 'free',
      canUseCIS: plan === 'pro' || plan === 'enterprise',
      canUseTenders: plan !== 'free',
      canUseAdvancedReports: plan === 'pro' || plan === 'enterprise',
    };
  }, [currentCompany]);

  const contextValue = useMemo<CompanyContextValue>(() => ({
    currentCompany,
    currentProject,
    currentUser,
    companies,
    projects,
    isLoading,
    switchCompany,
    switchProject,
    refreshProjects,
    can,
    isAdmin: can('company_admin'),
    isManager: can('manager'),
    isSuperAdmin: can('super_admin'),
    planLimits,
  }), [
    currentCompany,
    currentProject,
    currentUser,
    companies,
    projects,
    isLoading,
    switchCompany,
    switchProject,
    refreshProjects,
    can,
    planLimits,
  ]);

  return (
    <CompanyContext.Provider value={contextValue}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}
