import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

type UseAuthOptions = {
  autoFetch?: boolean;
};

/** Each `useAuth` instance registers here so we can sync all subscribers after login/OAuth. */
const authRefreshListeners = new Set<(opts?: { silent?: boolean }) => void | Promise<void>>();

export function subscribeAuthRefresh(
  listener: (opts?: { silent?: boolean }) => void | Promise<void>,
): () => void {
  authRefreshListeners.add(listener);
  return () => authRefreshListeners.delete(listener);
}

/**
 * Re-run auth resolution for every mounted `useAuth` hook (e.g. after password login stores a token).
 * Use `silent` so the app does not flash the global loading state on post-login refresh.
 */
export async function notifyAuthRefresh(opts?: { silent?: boolean }) {
  await Promise.all(
    [...authRefreshListeners].map(async listener => {
      try {
        await listener(opts);
      } catch (err) {
        console.error("[useAuth] notifyAuthRefresh listener error:", err);
      }
    }),
  );
}

type FetchOpts = { silent?: boolean };

export type UseAuthReturn = {
  user: Auth.User | null;
  loading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
  logout: () => Promise<void>;
};

/**
 * Internal hook — DO NOT call from components. Mount `<AuthProvider>` at
 * the app root (see `contexts/auth-context.tsx`) and import `useAuth`
 * from there. Direct calls bypass the Context and cause N independent
 * `Api.getMe()` fetches per page load (one per call site). The
 * Context-wrapped `useAuth` shares a single fetch across the tree.
 */
export function useAuthInternal(options?: UseAuthOptions): UseAuthReturn {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const queryClient = useQueryClient();

  const fetchUser = useCallback(async (opts?: FetchOpts) => {
    const silent = opts?.silent ?? false;
    try {
      if (!silent) setLoading(true);
      setError(null);

      // Web platform: use cookie-based auth, fetch user from API
      if (Platform.OS === "web") {
        const apiUser = await Api.getMe();

        if (apiUser) {
          const userInfo: Auth.User = {
            id: apiUser.id,
            openId: apiUser.openId,
            name: apiUser.name,
            email: apiUser.email,
            loginMethod: apiUser.loginMethod,
            lastSignedIn: new Date(apiUser.lastSignedIn),
            role: apiUser.role,
            companyId: apiUser.companyId,
            companyRole: apiUser.companyRole,
            companyUserId: apiUser.companyUserId,
            jobTitle: apiUser.jobTitle,
            department: apiUser.department,
          };
          setUser(userInfo);
          // Cache user info in localStorage for faster subsequent loads
          await Auth.setUserInfo(userInfo);
        } else {
          setUser(null);
          await Auth.clearUserInfo();
        }
        return;
      }

      // Native: Bearer token in SecureStore. Always resolve the user from the API
      // when there is no cache — otherwise OAuth/password login leaves a token
      // but useAuth stays "logged out" until the next cold start.
      const sessionToken = await Auth.getSessionToken();
      if (!sessionToken) {
        setUser(null);
        await Auth.clearUserInfo();
        return;
      }

      const apiUser = await Api.getMe();
      if (apiUser) {
        const userInfo: Auth.User = {
          id: apiUser.id,
          openId: apiUser.openId,
          name: apiUser.name,
          email: apiUser.email,
          loginMethod: apiUser.loginMethod,
          lastSignedIn: new Date(apiUser.lastSignedIn),
          role: apiUser.role,
          companyId: apiUser.companyId,
          companyRole: apiUser.companyRole,
          companyUserId: apiUser.companyUserId,
          jobTitle: apiUser.jobTitle,
          department: apiUser.department,
        };
        setUser(userInfo);
        await Auth.setUserInfo(userInfo);
        return;
      }

      const cachedUser = await Auth.getUserInfo();
      if (cachedUser) {
        setUser(cachedUser);
      } else {
        setUser(null);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch user");
      console.error("[useAuth] fetchUser error:", error);
      setError(error);
      setUser(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    return subscribeAuthRefresh(fetchUser);
  }, [fetchUser]);

  const logout = useCallback(async () => {
    try {
      await Api.logout();
    } catch (err) {
      console.error("[Auth] Logout API call failed:", err);
      // Continue with logout even if API call fails
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      setUser(null);
      setError(null);
      // Drop every cached tRPC/TanStack Query result for the previous
      // session. Without this, screens that call useQuery still render the
      // last user's data (projects, defects, …) until each query
      // independently re-fetches; on a shared device that's a tenant leak.
      // `clear()` evicts both data and metadata so the next mount fetches
      // from scratch under the new (or no) session.
      queryClient.clear();
      // Mirror the post-login broadcast (login.tsx → notifyAuthRefresh) so
      // every other useAuth() instance — CompanyProvider in particular —
      // re-resolves and clears its cached user. Without this, the screen
      // that called logout() flips to "signed out" but the rest of the app
      // keeps showing the previous user until each component re-renders.
      await notifyAuthRefresh({ silent: true });
    }
  }, [queryClient]);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    if (autoFetch) {
      if (Platform.OS === "web") {
        // Web: fetch user from API directly (user will login manually if needed)
        fetchUser();
      } else {
        // Native: check for cached user info first for faster initial load
        Auth.getUserInfo().then((cachedUser) => {
          if (cachedUser) {
            setUser(cachedUser);
            setLoading(false);
          } else {
            // No cached user, check session token
            fetchUser(undefined);
          }
        });
      }
    } else {
      setLoading(false);
    }
  }, [autoFetch, fetchUser]);

  return {
    user,
    loading,
    error,
    isAuthenticated,
    refresh: fetchUser,
    logout,
  };
}
