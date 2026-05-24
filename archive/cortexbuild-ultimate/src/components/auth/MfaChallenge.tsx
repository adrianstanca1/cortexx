import { useState } from 'react';
import { Loader2, KeyRound, RefreshCw } from 'lucide-react';
import { API_BASE } from '../../lib/auth-storage';

interface MfaChallengeProps {
  tempToken: string;
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * MFA Challenge component: 6-digit TOTP input with optional recovery code fallback.
 */
export function MfaChallenge({ tempToken, onSuccess, onCancel }: MfaChallengeProps) {
  const [method, setMethod] = useState<'totp' | 'recovery'>('totp');
  const [totp, setTotp] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const body = { tempToken };
      if (method === 'totp') {
        if (!totp || totp.length !== 6) {
          throw new Error('TOTP must be 6 digits');
        }
        (body as { token?: string }).token = totp;
      } else {
        if (!recoveryCode.trim()) {
          throw new Error('Recovery code is required');
        }
        (body as { recoveryCode?: string }).recoveryCode = recoveryCode.trim();
      }

      const res = await fetch(`${API_BASE}/auth/mfa/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'MFA verification failed');
      }

      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTotpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, 6);
    setTotp(value);
  };

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
      }}
    >
      <div style={{ width: '100%', maxWidth: '380px' }}>
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
            Verify your identity
          </h1>
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              color: 'rgba(90,106,130,0.9)',
              margin: '6px 0 0',
            }}
          >
            {method === 'totp'
              ? 'Enter the 6-digit code from your authenticator app'
              : 'Enter a recovery code from your backup'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {method === 'totp' ? (
            <div>
              <label
                htmlFor="totp-input"
                style={{
                  display: 'block',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'rgba(184,196,212,0.8)',
                  marginBottom: '6px',
                }}
              >
                Authentication Code
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'rgba(90,106,130,0.6)',
                    pointerEvents: 'none',
                  }}
                >
                  <KeyRound size={14} />
                </span>
                <input
                  id="totp-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={totp}
                  onChange={handleTotpChange}
                  placeholder="000000"
                  autoComplete="off"
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
                    background: 'rgba(15,23,42,0.5)',
                    border: '1px solid rgba(30,41,59,0.6)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '16px',
                    fontWeight: 600,
                    letterSpacing: '0.3em',
                    fontFamily: "'JetBrains Mono', monospace",
                    boxSizing: 'border-box',
                    transition: 'border 0.2s',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(245,158,11,0.4)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(30,41,59,0.6)';
                  }}
                />
              </div>
            </div>
          ) : (
            <div>
              <label
                htmlFor="recovery-input"
                style={{
                  display: 'block',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'rgba(184,196,212,0.8)',
                  marginBottom: '6px',
                }}
              >
                Recovery Code
              </label>
              <input
                id="recovery-input"
                type="text"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                placeholder="XXXXXXXX"
                autoComplete="off"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'rgba(15,23,42,0.5)',
                  border: '1px solid rgba(30,41,59,0.6)',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  fontSize: '16px',
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', monospace",
                  boxSizing: 'border-box',
                  transition: 'border 0.2s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(245,158,11,0.4)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(30,41,59,0.6)';
                }}
              />
            </div>
          )}

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
              <span aria-hidden="true">⚠</span> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 16px',
              background: loading ? 'rgba(245,158,11,0.3)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
              border: 'none',
              borderRadius: '8px',
              color: '#080b12',
              fontWeight: 700,
              fontSize: '14px',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {loading && <Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} />}
            Verify
          </button>
        </form>

        <div
          style={{
            marginTop: '20px',
            textAlign: 'center',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            color: 'rgba(90,106,130,0.8)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMethod(method === 'totp' ? 'recovery' : 'totp');
              setError('');
              setTotp('');
              setRecoveryCode('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#f59e0b',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '13px',
              fontFamily: "'DM Sans', sans-serif",
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.color = '#fcd34d';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.color = '#f59e0b';
            }}
          >
            <RefreshCw size={14} />
            {method === 'totp' ? 'Use recovery code instead' : 'Use authenticator app'}
          </button>

          <button
            type="button"
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(90,106,130,0.8)',
              cursor: 'pointer',
              fontSize: '13px',
              fontFamily: "'DM Sans', sans-serif",
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.color = '#f1f5f9';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.color = 'rgba(90,106,130,0.8)';
            }}
          >
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
}

export default MfaChallenge;
