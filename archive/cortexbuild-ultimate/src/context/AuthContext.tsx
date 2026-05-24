import React, { createContext, useContext, useEffect, useState } from 'react';
import { clearToken, getStoredUser, setStoredUser, API_BASE } from '../lib/auth-storage';
import { agentDebugLog } from '@/lib/agentDebugLog';

interface Profile {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string;
  phone?: string;
  avatar?: string;
}

/**
 * Outcome of a sign-in attempt.
 *  - `'ok'`           — session cookie issued; `user` populated.
 *  - `'mfa_required'` — server demanded a second factor; AuthContext has set
 *                       `mfaRequired` + `mfaTempToken` for the UI to render the
 *                       challenge. The promise resolves; it does NOT throw.
 *
 * Real auth failures (bad password, network, server error) still throw —
 * callers can keep their normal try/catch for those.
 */
export type SignInResult = 'ok' | 'mfa_required';

interface AuthContextValue {
  user: Profile | null;
  profile: Profile | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  mfaRequired: boolean;
  mfaTempToken: string | null;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signUp: (email: string, password: string, name: string, company: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  resetMfaState: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // token is kept for NotificationsPanel which reads it; cookie handles actual auth
  const [token] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaTempToken, setMfaTempToken] = useState<string | null>(null);

  // On mount, restore session from cookie-backed auth
  useEffect(() => {
    const loadUser = async () => {
      const stored = getStoredUser();
      let meStatus: number | null = null;
      let outcome: 'no_stored' | 'me_ok' | 'me_failed' | 'me_network_error' = 'no_stored';

      if (stored) {
        try {
          // Validate session with a backend call (cookie sent automatically)
          const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
          meStatus = res.status;
          if (res.ok) {
            const userData = await res.json();
            setUser(userData as Profile);
            setStoredUser(userData);
            outcome = 'me_ok';
          } else {
            console.warn('Session validation failed, clearing session.', res.status);
            clearToken();
            setUser(null);
            outcome = 'me_failed';
          }
        } catch (error) {
          console.error('Error validating session:', error);
          // Don't clear session on network error — cookie might still be valid
          setUser(stored as unknown as Profile | null);
          outcome = 'me_network_error';
        }
      }
      setLoading(false);
      // #region agent log
      agentDebugLog({
        hypothesisId: 'H1',
        location: 'AuthContext.tsx:loadUser',
        message: 'auth bootstrap finished',
        data: { outcome, meStatus, hadStored: Boolean(stored), apiBaseLen: API_BASE?.length ?? 0 },
      });
      // #endregion
    };
    loadUser();
  }, []);

  const signIn = async (email: string, password: string): Promise<SignInResult> => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include httpOnly cookie
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');

    // MFA gate: server returns a short-lived temp token instead of a session.
    // We surface this as a structured result rather than an exception so callers
    // can branch cleanly without inspecting error message strings.
    if (data.requires2FA || data.mfaRequired) {
      setMfaRequired(true);
      setMfaTempToken(data.tempToken || data.mfaToken || null);
      return 'mfa_required';
    }

    // Token is now in httpOnly cookie — only store user data
    setStoredUser(data.user);
    setUser(data.user as Profile);
    return 'ok';
  };

  const signUp = async (email: string, password: string, name: string, company: string) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      credentials: 'include', // Include httpOnly cookie
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, company }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed');
    // Token is in httpOnly cookie - only store user data
    setStoredUser(data.user);
    setUser(data.user as Profile);
  };

  const signOut = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include', // Send httpOnly cookie
      });
    } catch {
      // Network error — still clear local state
    }
    clearToken();
    setUser(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      credentials: 'include', // Send httpOnly cookie
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Update failed');
    const updated = { ...user, ...data };
    setUser(updated);
    setStoredUser(updated);
  };

  const resetMfaState = () => {
    setMfaRequired(false);
    setMfaTempToken(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile: user,
      token,
      loading,
      isAuthenticated: !!user,
      mfaRequired,
      mfaTempToken,
      signIn,
      signUp,
      signOut,
      updateProfile,
      resetMfaState,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
