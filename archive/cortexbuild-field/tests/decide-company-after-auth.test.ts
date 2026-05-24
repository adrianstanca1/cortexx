import { describe, it, expect } from 'vitest';

import { buildCompanyPinForUser } from '@/lib/decide-company-after-auth';
import type { Company } from '@/lib/company-context';

/**
 * Fixture: the unauthenticated default. Mirrors the shape of
 * MOCK_COMPANIES[0] in CompanyProvider — what `currentCompany` is
 * before any user is resolved.
 */
const DEFAULT: Company = {
  id: 1,
  name: 'CortexBuild Ltd.',
  slug: 'cortexbuild',
  plan: 'pro',
  primaryColor: '#1E3A5F',
  cisStatus: 'registered_20',
  activeAiProvider: 'forge',
  activeAiModel: 'default',
  maxProjects: 999,
  maxUsers: 999,
  maxPipelines: 999,
};

describe('buildCompanyPinForUser', () => {
  it('returns null when no user is signed in (caller leaves currentCompany alone)', () => {
    expect(buildCompanyPinForUser(null, DEFAULT)).toBeNull();
  });

  it('returns null when the user has no companyId (memberless account)', () => {
    expect(buildCompanyPinForUser({ companyId: null }, DEFAULT)).toBeNull();
    expect(buildCompanyPinForUser({ companyId: undefined }, DEFAULT)).toBeNull();
  });

  it('returns the SAME default reference (no churn) when user.companyId matches the default id', () => {
    // Identity matters: setCurrentCompany will use referential equality
    // to dedupe, and downstream useEffect deps fire on identity change.
    // Spreading would be wasteful churn here.
    const result = buildCompanyPinForUser({ companyId: DEFAULT.id }, DEFAULT);
    expect(result).toBe(DEFAULT);
  });

  it('returns a placeholder pinned to user.companyId when the user is in a non-default tenant', () => {
    // The bug this guards against: without pinning, settingsCompanyId
    // stays as DEFAULT.id (=1) and any user not in company 1 gets 403s
    // on every authenticated screen until they manually switch.
    const result = buildCompanyPinForUser({ companyId: 7 }, DEFAULT);
    expect(result?.id).toBe(7);
    // Real fields blanked — settingsQuery hydrates the rest. The UI
    // shows a brief loading state instead of the wrong tenant's name.
    expect(result?.name).toBe('');
    expect(result?.slug).toBe('');
    // Plan/limits stay as the default — safe defaults for the brief
    // window before settingsQuery lands.
    expect(result?.plan).toBe(DEFAULT.plan);
    expect(result?.maxProjects).toBe(DEFAULT.maxProjects);
  });

  it('does not consider `current` — that distinction lives in the caller', () => {
    // Earlier versions of this helper inspected `current.id !==
    // defaultCompany.id` to detect "user already switched". That heuristic
    // failed when the user explicitly switched TO the default-id tenant
    // (Bugbot finding on PR #78). The fix: drop the heuristic from the
    // helper and put a `pinnedForUserIdRef` guard in CompanyProvider so
    // the helper is only ever called once per user.id transition. This
    // test pins the simplified contract — the helper does not look at
    // any "current" value.
    const result = buildCompanyPinForUser({ companyId: 9 }, DEFAULT);
    expect(result?.id).toBe(9);
    // Calling it again with the same input gives an equivalent placeholder —
    // the caller is responsible for not invoking it twice unnecessarily.
    const second = buildCompanyPinForUser({ companyId: 9 }, DEFAULT);
    expect(second?.id).toBe(9);
  });
});
