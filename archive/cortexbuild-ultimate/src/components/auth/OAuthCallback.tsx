import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { setToken, setStoredUser } from '../../lib/auth-storage';
import { apiFetch } from '../../services/api';

export function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const errorParam = searchParams.get('error');
    const code = searchParams.get('code');
    const oauthToken = searchParams.get('oauth_token'); // legacy fallback (dev only)

    // ── New: exchange one-time code for JWT ───────────────────────────────────
    if (code) {
      apiFetch<{ token: string; user: Record<string, unknown> }>(`/auth/exchange?code=${encodeURIComponent(code)}`)
        .then(({ token, user }) => {
          setToken(token);
          setStoredUser({
            id: String(user.id ?? ''),
            name: String(user.name || user.email),
            email: String(user.email ?? ''),
            role: (user.role as string) || 'field_worker',
            company: '',  // never use company_id UUID as display name — resolve via /companies
            phone: null,
            avatar: null,
            organization_id: (user.organizationId as string | null) ?? null,
            company_id: (user.companyId as string | null) ?? null,
            effectiveOrganizationId: (user.organizationId ?? user.companyId ?? null) as string | null,
          });
          setStatus('success');
          setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
        })
        .catch((err: unknown) => {
          console.error('[OAuthCallback] code exchange failed:', err);
          setStatus('error');
          setError('Failed to complete sign-in. Please try again.');
        });
      return;
    }

    // ── Legacy: direct JWT in URL (dev / backward compat) ─────────────────────
    if (oauthToken) {
      try {
        const payload = JSON.parse(atob(oauthToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        const user = {
          id: payload.id,
          name: payload.name || payload.email,
          email: payload.email,
          role: payload.role || 'field_worker',
          company: '',  // company_id is a UUID, not a display name
          phone: null,
          avatar: null,
          organization_id: payload.organization_id ?? null,
          company_id: payload.company_id ?? null,
          effectiveOrganizationId: payload.organization_id ?? payload.company_id ?? null,
        };
        setToken(oauthToken);
        setStoredUser(user);
        setStatus('success');
        setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
      } catch (err) {
        console.error('[OAuthCallback] failed to decode JWT payload:', err);
        setStatus('error');
        setError('Failed to process authentication. Please try again.');
      }
      return;
    }

    // ── OAuth provider returned an error ───────────────────────────────────────
    if (errorParam) {
      setStatus('error');
      switch (errorParam) {
        case 'invalid_state':
          setError('OAuth state expired. Please try again.');
          break;
        case 'google_auth_failed':
        case 'microsoft_auth_failed':
          setError('Authentication failed. Please try again.');
          break;
        case 'google_not_configured':
        case 'microsoft_not_configured':
          setError('OAuth provider is not configured on this server.');
          break;
        case 'state_expired':
          setError('OAuth session expired. Please try again.');
          break;
        default:
          setError('OAuth authentication failed. Please try again.');
      }
      return;
    }

    // ── No token and no error ─────────────────────────────────────────────────
    setStatus('error');
    setError('Invalid authentication response.');
  }, [searchParams, navigate]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #080b12 0%, #0f172a 100%)',
      padding: '24px',
    }}>
      <div style={{
        background: 'rgba(30,41,59,0.5)',
        border: '1px solid rgba(245,158,11,0.3)',
        borderRadius: '12px',
        padding: '32px',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center',
      }}>
        {status === 'loading' && (
          <>
            <Loader2
              size={48}
              style={{
                color: '#f59e0b',
                animation: 'spin 1s linear infinite',
                marginBottom: '20px',
              }}
            />
            <h2 style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 700,
              fontSize: '20px',
              color: '#f1f5f9',
              marginBottom: '8px',
            }}>
              Completing Sign-In
            </h2>
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              color: 'rgba(148,163,184,0.8)',
            }}>
              Setting up your workspace...
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle
              size={48}
              style={{ color: '#10b981', marginBottom: '20px' }}
            />
            <h2 style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 700,
              fontSize: '20px',
              color: '#f1f5f9',
              marginBottom: '8px',
            }}>
              Sign-In Successful
            </h2>
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              color: 'rgba(148,163,184,0.8)',
            }}>
              Redirecting to dashboard...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle
              size={48}
              style={{ color: '#ef4444', marginBottom: '20px' }}
            />
            <h2 style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 700,
              fontSize: '20px',
              color: '#f1f5f9',
              marginBottom: '8px',
            }}>
              Sign-In Failed
            </h2>
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              color: 'rgba(148,163,184,0.8)',
              marginBottom: '20px',
            }}>
              {error}
            </p>
            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 24px',
                color: '#080b12',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Back to Login
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default OAuthCallback;
