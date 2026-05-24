import { useState } from 'react';
import { Loader2, Copy, Check, Lock, AlertCircle } from 'lucide-react';
import { API_BASE } from '../lib/auth-storage';

interface MfaSetupState {
  secret: string;
  qrDataUrl: string;
  recoveryCodes: string[];
}

interface MfaDisableState {
  step: 'confirm' | 'verify';
  token: string;
}

/**
 * SettingsMfa: Manage TOTP-based MFA enrollment and disablement.
 */
export function SettingsMfa({ onClose: _onClose }: { onClose?: () => void } = {}) {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  // Setup flow
  const [setupState, setSetupState] = useState<MfaSetupState | null>(null);
  const [setupVerifyCode, setSetupVerifyCode] = useState('');

  // Disable flow
  const [disableState, setDisableState] = useState<MfaDisableState | null>(null);
  const [disableVerifyCode, setDisableVerifyCode] = useState('');

  // Load MFA status on mount
  const [initialized, setInitialized] = useState(false);
  if (!initialized) {
    fetchMfaStatus();
  }

  async function fetchMfaStatus() {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        credentials: 'include',
      });
      if (res.ok) {
        const user = await res.json();
        setMfaEnabled(!!user.mfa_enabled);
      }
    } catch (err) {
      console.error('Failed to fetch MFA status:', err);
    }
    setInitialized(true);
  }

  const handleStartEnrollment = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/mfa/enrol`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to start enrollment');
      }
      setSetupState(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Enrollment failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySetup = async () => {
    if (!setupVerifyCode || setupVerifyCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/mfa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: setupVerifyCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Verification failed');
      }

      setMfaEnabled(true);
      setSetupState(null);
      setSetupVerifyCode('');
      // Show final recovery codes
      alert(`MFA enabled! Save these recovery codes in a safe place:\n\n${data.recoveryCodes.join('\n')}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStartDisable = () => {
    setDisableState({ step: 'verify', token: '' });
    setError('');
  };

  const handleVerifyDisable = async () => {
    if (!disableVerifyCode || disableVerifyCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/mfa/disable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: disableVerifyCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Disablement failed');
      }

      setMfaEnabled(false);
      setDisableState(null);
      setDisableVerifyCode('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Disablement failed');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  // Setup flow UI
  if (setupState) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>
          Enable Two-Factor Authentication
        </h2>

        <div style={{ background: 'rgba(15,23,42,0.5)', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
            Step 1: Scan QR Code
          </h3>
          <p style={{ fontSize: '13px', color: 'rgba(90,106,130,0.9)', marginBottom: '16px' }}>
            Scan this QR code with your authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.)
          </p>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <img src={setupState.qrDataUrl} alt="QR Code" style={{ maxWidth: '200px' }} />
          </div>
          <p style={{ fontSize: '12px', color: 'rgba(90,106,130,0.8)', marginBottom: '12px' }}>
            Can't scan? Enter this code manually:
          </p>
          <code
            style={{
              background: 'rgba(0,0,0,0.3)',
              padding: '8px 12px',
              borderRadius: '4px',
              display: 'block',
              wordBreak: 'break-all',
              fontSize: '12px',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {setupState.secret}
          </code>
        </div>

        <div style={{ background: 'rgba(15,23,42,0.5)', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
            Step 2: Save Recovery Codes
          </h3>
          <p style={{ fontSize: '13px', color: 'rgba(90,106,130,0.9)', marginBottom: '16px' }}>
            Save these recovery codes in a safe place. You'll need them if you lose access to your authenticator.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {setupState.recoveryCodes.map((code, i) => (
              <div
                key={i}
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                <span>{code}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(code, `code-${i}`)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'rgba(90,106,130,0.6)',
                    padding: '4px',
                  }}
                >
                  {copied === `code-${i}` ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'rgba(15,23,42,0.5)', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
            Step 3: Verify Setup
          </h3>
          <p style={{ fontSize: '13px', color: 'rgba(90,106,130,0.9)', marginBottom: '12px' }}>
            Enter the 6-digit code from your authenticator app
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={setupVerifyCode}
            onChange={(e) => setSetupVerifyCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
            placeholder="000000"
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(30,41,59,0.6)',
              borderRadius: '4px',
              color: '#f1f5f9',
              fontSize: '14px',
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '0.2em',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <div style={{
            background: 'rgba(248,113,113,0.07)',
            border: '1px solid rgba(248,113,113,0.2)',
            borderRadius: '4px',
            padding: '12px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#f87171',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleVerifySetup}
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              border: 'none',
              borderRadius: '4px',
              color: '#080b12',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loading && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
            Verify & Enable
          </button>
          <button
            onClick={() => {
              setSetupState(null);
              setSetupVerifyCode('');
            }}
            style={{
              padding: '12px 20px',
              background: 'transparent',
              border: '1px solid rgba(30,41,59,0.6)',
              borderRadius: '4px',
              color: '#f1f5f9',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Disable flow UI
  if (disableState) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        <div style={{
          background: 'rgba(248,113,113,0.07)',
          border: '1px solid rgba(248,113,113,0.2)',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          gap: '12px',
        }}>
          <AlertCircle size={20} style={{ color: '#f87171', flexShrink: 0 }} />
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f87171', marginBottom: '4px' }}>
              Disable Two-Factor Authentication
            </h3>
            <p style={{ fontSize: '13px', color: 'rgba(90,106,130,0.9)' }}>
              Enter the 6-digit code from your authenticator to disable MFA.
            </p>
          </div>
        </div>

        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={disableVerifyCode}
          onChange={(e) => setDisableVerifyCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
          placeholder="000000"
          style={{
            width: '100%',
            padding: '12px',
            background: 'rgba(15,23,42,0.5)',
            border: '1px solid rgba(30,41,59,0.6)',
            borderRadius: '4px',
            color: '#f1f5f9',
            fontSize: '14px',
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.2em',
            boxSizing: 'border-box',
            marginBottom: '20px',
          }}
        />

        {error && (
          <div style={{
            background: 'rgba(248,113,113,0.07)',
            border: '1px solid rgba(248,113,113,0.2)',
            borderRadius: '4px',
            padding: '12px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#f87171',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleVerifyDisable}
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px',
              background: '#dc2626',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loading && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
            Disable MFA
          </button>
          <button
            onClick={() => {
              setDisableState(null);
              setDisableVerifyCode('');
            }}
            style={{
              padding: '12px 20px',
              background: 'transparent',
              border: '1px solid rgba(30,41,59,0.6)',
              borderRadius: '4px',
              color: '#f1f5f9',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Main status view
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>
        Two-Factor Authentication
      </h2>

      <div style={{ background: 'rgba(15,23,42,0.5)', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Lock size={20} style={{ color: mfaEnabled ? '#10b981' : 'rgba(90,106,130,0.6)' }} />
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
                {mfaEnabled ? 'Enabled' : 'Disabled'}
              </h3>
              <p style={{
                fontSize: '12px',
                color: 'rgba(90,106,130,0.8)',
                margin: '4px 0 0',
              }}>
                {mfaEnabled
                  ? 'Your account is protected with TOTP-based MFA'
                  : 'Add an extra layer of security to your account'}
              </p>
            </div>
          </div>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: mfaEnabled ? '#10b981' : 'rgba(90,106,130,0.3)',
          }} />
        </div>
      </div>

      {mfaEnabled ? (
        <button
          onClick={handleStartDisable}
          style={{
            width: '100%',
            padding: '12px',
            background: '#dc2626',
            border: 'none',
            borderRadius: '4px',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Disable MFA
        </button>
      ) : (
        <button
          onClick={handleStartEnrollment}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            border: 'none',
            borderRadius: '4px',
            color: '#080b12',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {loading && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
          Enable MFA
        </button>
      )}
    </div>
  );
}

export default SettingsMfa;
