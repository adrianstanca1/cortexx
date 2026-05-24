import { useState } from 'react';
import {
  ArrowRight, Building2, Eye, EyeOff, Loader2, ShieldCheck, Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { OAuthButton } from './OAuthButtons';
import { MfaChallenge } from './MfaChallenge';

type Mode = 'login' | 'signup';

const TRUST_BADGES = [
  { icon: ShieldCheck, text: 'GDPR Compliant' },
  { icon: Building2, text: 'UK Construction' },
  { icon: Zap, text: 'Instant Setup' },
];

/**
 * Right-side authentication form. Owns its own form state and delegates
 * email/password auth to AuthContext.signIn / signUp. OAuth is handled by
 * OAuthButton, which navigates to the API host directly.
 */
export function LoginForm() {
  const { signIn, signUp, mfaRequired, mfaTempToken, resetMfaState } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    resetMfaState();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        // signIn resolves with 'ok' or 'mfa_required'. The mfa_required case
        // simply transitions the UI via context state; no error to surface.
        await signIn(email, password);
      } else {
        await signUp(email, password, name, company);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  // Show MFA challenge if required
  if (mfaRequired && mfaTempToken) {
    return (
      <MfaChallenge
        tempToken={mfaTempToken}
        onSuccess={() => {
          resetMfaState();
          window.location.href = '/dashboard';
        }}
        onCancel={() => {
          resetMfaState();
          setEmail('');
          setPassword('');
        }}
      />
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 36px',
        background: '#0d1117',
        borderLeft: '1px solid rgba(30,41,59,0.6)',
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Corner ornaments */}
      <div aria-hidden="true" style={{ position: 'absolute', top: '24px', left: '24px', pointerEvents: 'none' }}>
        {[72, 48, 28].map((w, i) => (
          <div
            key={`tl-${w}`}
            style={{
              height: '1px',
              marginBottom: '5px',
              background: `linear-gradient(90deg, rgba(245,158,11,${0.25 - i * 0.06}), transparent)`,
              width: `${w}px`,
            }}
          />
        ))}
      </div>
      <div aria-hidden="true" style={{ position: 'absolute', bottom: '24px', right: '24px', pointerEvents: 'none' }}>
        {[28, 48, 72].map((w, i) => (
          <div
            key={`br-${w}`}
            style={{
              height: '1px',
              marginBottom: '5px',
              background: `linear-gradient(90deg, transparent, rgba(245,158,11,${0.25 - (2 - i) * 0.06}))`,
              width: `${w}px`,
              marginLeft: 'auto',
            }}
          />
        ))}
      </div>

      {/* Mobile-only logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '36px' }}>
        <div
          style={{
            width: '36px', height: '36px',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            borderRadius: '9px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(245,158,11,0.3)',
          }}
        >
          <Building2 size={18} style={{ color: '#080b12' }} />
        </div>
        <div>
          <div
            style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 800, fontSize: '17px',
              color: '#f1f5f9', lineHeight: 1,
            }}
          >
            CortexBuild
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '8px', color: '#f59e0b',
              letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '3px',
            }}
          >
            ULTIMATE
          </div>
        </div>
      </div>

      {/* Form card */}
      <div style={{ width: '100%', maxWidth: '380px', animation: 'slideUp 0.6s ease 0.2s both' }}>
        {/* Heading */}
        <div style={{ marginBottom: '28px' }}>
          <h1
            style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 800,
              fontSize: '22px',
              color: '#f1f5f9',
              letterSpacing: '-0.03em',
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {mode === 'login' ? 'Welcome back' : 'Start building'}
          </h1>
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              color: 'rgba(90,106,130,0.9)',
              margin: '6px 0 0',
            }}
          >
            {mode === 'login'
              ? 'Sign in to your construction workspace'
              : 'Create your CortexBuild account — free to start'}
          </p>
        </div>

        {/* Mode label divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(30,41,59,0.9)' }} />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '9px',
              color: 'rgba(90,106,130,0.6)',
              letterSpacing: '0.1em',
            }}
          >
            {mode === 'login' ? 'SIGN_IN' : 'REGISTER'}
          </span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(30,41,59,0.9)' }} />
        </div>

        {/* OAuth Buttons (above email form for prominence) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          <OAuthButton provider="google" />
          <OAuthButton provider="microsoft" />
        </div>

        {/* "or with email" divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0 18px' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(30,41,59,0.9)' }} />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '9px',
              color: 'rgba(90,106,130,0.5)',
              letterSpacing: '0.1em',
            }}
          >
            OR WITH EMAIL
          </span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(30,41,59,0.9)' }} />
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {mode === 'signup' && (
            <>
              <div>
                <label
                  htmlFor="auth-name"
                  style={{
                    display: 'block', fontFamily: "'DM Sans', sans-serif",
                    fontSize: '12px', fontWeight: 600,
                    color: 'rgba(184,196,212,0.8)', marginBottom: '6px',
                    letterSpacing: '0.01em',
                  }}
                >
                  Full name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Your full name"
                  className="auth-input"
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
              <div>
                <label
                  htmlFor="auth-company"
                  style={{
                    display: 'block', fontFamily: "'DM Sans', sans-serif",
                    fontSize: '12px', fontWeight: 600,
                    color: 'rgba(184,196,212,0.8)', marginBottom: '6px',
                  }}
                >
                  Company name
                </label>
                <input
                  id="auth-company"
                  type="text"
                  autoComplete="organization"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  required
                  placeholder="Your company"
                  className="auth-input"
                  onFocus={() => setFocusedField('company')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
            </>
          )}

          {/* Email */}
          <div>
            <label
              htmlFor="auth-email"
              style={{
                display: 'block', fontFamily: "'DM Sans', sans-serif",
                fontSize: '12px', fontWeight: 600,
                color: 'rgba(184,196,212,0.8)', marginBottom: '6px',
              }}
            >
              Email address
            </label>
            <div style={{ position: 'relative' }}>
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                  color: focusedField === 'email' ? '#f59e0b' : 'rgba(90,106,130,0.6)',
                  transition: 'color 0.2s', pointerEvents: 'none',
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '13px',
                }}
              >
                @
              </span>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.co.uk"
                className="auth-input auth-input-icon"
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label
                htmlFor="auth-password"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '12px', fontWeight: 600,
                  color: 'rgba(184,196,212,0.8)',
                }}
              >
                Password
              </label>
              {mode === 'signup' && (
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '9px',
                    color: 'rgba(90,106,130,0.5)',
                    letterSpacing: '0.06em',
                  }}
                >
                  MIN 8 CHARS
                </span>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: focusedField === 'password' ? '#f59e0b' : 'rgba(90,106,130,0.6)',
                  transition: 'color 0.2s',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                id="auth-password"
                type={showPass ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={mode === 'signup' ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="auth-input auth-input-icon"
                style={{ paddingRight: '42px' }}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
              />
              <button
                type="button"
                aria-label={showPass ? 'Hide password' : 'Show password'}
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(90,106,130,0.6)', padding: '4px',
                  transition: 'color 0.2s',
                }}
              >
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              style={{
                padding: '10px 14px',
                background: 'rgba(248,113,113,0.07)',
                border: '1px solid rgba(248,113,113,0.2)',
                borderRadius: '8px',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '12.5px',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span aria-hidden="true" style={{ fontSize: '16px' }}>⚠</span> {error}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading} className="submit-btn" style={{ marginTop: '4px' }}>
            {loading && <Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} />}
            {mode === 'login' ? 'Sign In' : 'Create Account'}
            {!loading && <ArrowRight size={15} />}
          </button>
        </form>

        {/* Mode toggle */}
        <div
          style={{
            marginTop: '20px',
            textAlign: 'center',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            color: 'rgba(90,106,130,0.8)',
          }}
        >
          {mode === 'login' ? (
            <>
              No account?{' '}
              <button type="button" className="mode-link" onClick={() => switchMode('signup')}>
                Sign up free
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" className="mode-link" onClick={() => switchMode('login')}>
                Sign in
              </button>
            </>
          )}
        </div>

        {/* Trust badges */}
        <div
          style={{
            marginTop: '32px',
            paddingTop: '24px',
            borderTop: '1px solid rgba(30,41,59,0.6)',
            display: 'flex',
            justifyContent: 'center',
            gap: '20px',
          }}
        >
          {TRUST_BADGES.map(({ icon: Icon, text }) => (
            <div
              key={text}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}
            >
              <Icon size={14} style={{ color: 'rgba(245,158,11,0.45)' }} />
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '8px',
                  color: 'rgba(90,106,130,0.5)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                }}
              >
                {text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p
        style={{
          position: 'absolute', bottom: '20px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '9px',
          color: 'rgba(61,79,102,0.6)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        © {new Date().getFullYear()} CortexBuild Ltd · All rights reserved
      </p>
    </div>
  );
}

export default LoginForm;
