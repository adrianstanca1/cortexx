import React, { createContext, useContext } from 'react';
import { useAuthInternal, type UseAuthReturn } from '@/hooks/use-auth';

/**
 * Single shared `useAuth` instance for the whole React tree.
 *
 * Before this Context existed, each component that called `useAuth()`
 * mounted its own state + its own `Api.getMe()` fetch on mount. On the
 * /welcome route alone, two consumers (auth-gate + welcome screen) fired
 * concurrent fetches, and React's mount/unmount churn during the
 * `/ → /welcome` redirect produced ~9 `/api/auth/me` calls in 6 seconds
 * per unauthenticated visitor — and 36 corresponding console errors.
 *
 * Wrap the app tree once with `<AuthProvider>` (in `app/_layout.tsx`,
 * between `<QueryClientProvider>` and `<CompanyProvider>` — CompanyProvider
 * already depends on the auth user). All call sites import `useAuth`
 * from this file and share the single instance.
 *
 * The underlying `useAuthInternal` hook (in `hooks/use-auth.ts`) is the
 * real implementation; this file only adds the Context plumbing. The
 * `notifyAuthRefresh` / `subscribeAuthRefresh` broadcast helpers stay
 * in `hooks/use-auth.ts` and are imported directly by login + oauth flows.
 */

const AuthContext = createContext<UseAuthReturn | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuthInternal();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth(): UseAuthReturn {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      '`useAuth` must be used inside <AuthProvider>. ' +
        'AuthProvider lives at `app/_layout.tsx` between QueryClientProvider ' +
        'and CompanyProvider; if you see this error in a test, mock ' +
        '`@/contexts/auth-context` rather than `@/hooks/use-auth`.',
    );
  }
  return ctx;
}
