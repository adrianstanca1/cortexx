'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface SetupPayload {
  otpauthUrl: string
  qrPng: string
}

interface EnableResult {
  enabled: boolean
  backupCodes: string[]
  notice: string
}

// String literal; broader than a union so TS doesn't narrow it away
// inside conditional render branches where setStage is called from a
// nested handler. Runtime correctness comes from setStage at each
// transition, not from type narrowing.
type Stage = string

export default function SecurityPage() {
  const [stage, setStage] = useState<Stage>('loading')
  const [enrolled, setEnrolled] = useState<boolean>(false)
  const [setupData, setSetupData] = useState<SetupPayload | null>(null)
  const [enableResult, setEnableResult] = useState<EnableResult | null>(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Best-effort check of current 2FA state — we don't yet have a GET
    // endpoint, so infer from a probe call. A follow-up could add
    // /api/auth/2fa/status if this becomes annoying.
    setStage('idle')
  }, [])

  const startSetup = async () => {
    setStage('enrolling')
    setError(null)
    try {
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        if (data.code === 'ALREADY_ENABLED') {
          setEnrolled(true)
          setStage('enabled')
          return
        }
        throw new Error(data.error || 'Failed to start setup')
      }
      setSetupData(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
      setStage('idle')
    }
  }

  const enable = async (e: React.FormEvent) => {
    e.preventDefault()
    setStage('verifying')
    setError(null)
    try {
      const res = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invalid code')
      setEnableResult(data)
      setEnrolled(true)
      setStage('enabled')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
      setStage('enrolling')
    }
  }

  const disable = async (e: React.FormEvent) => {
    e.preventDefault()
    setStage('disabling')
    setError(null)
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to disable')
      setEnrolled(false)
      setSetupData(null)
      setEnableResult(null)
      setPassword('')
      setStage('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
      setStage('enabled')
    }
  }

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', padding: '20px 20px 100px 60px' }}>
      <Link href="/settings" style={{ display: 'inline-block', marginBottom: 12, fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a', textDecoration: 'none' }}>
        ← Settings
      </Link>

      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)', marginBottom: 4 }}>
        Two-factor authentication
      </h1>
      <p style={{ fontSize: 13, color: '#8ea8c5', fontFamily: 'var(--font-system)', marginBottom: 24, lineHeight: 1.5 }}>
        Adds a 6-digit code from an authenticator app on top of your password. Recommended for owners and admins.
      </p>

      {/* Idle: enrol */}
      {stage === 'idle' && !enrolled && (
        <section style={sectionStyle}>
          <div style={{ fontFamily: 'var(--font-system)', fontSize: 14, color: '#eef3fa', marginBottom: 14 }}>
            <strong>2FA is off.</strong> Click below to start enrolment with any authenticator app
            (Google Authenticator, Authy, 1Password, Bitwarden).
          </div>
          <button onClick={startSetup} style={primaryBtn}>Start 2FA setup</button>
        </section>
      )}

      {/* Enrolling: show QR */}
      {stage === 'enrolling' && setupData && (
        <section style={sectionStyle}>
          <div style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#8ea8c5', marginBottom: 14, lineHeight: 1.5 }}>
            1. Open your authenticator app and tap <strong style={{ color: '#eef3fa' }}>Add account → Scan QR</strong>.<br />
            2. Scan this code:
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setupData.qrPng} alt="TOTP QR code" style={{ display: 'block', margin: '12px auto', borderRadius: 12, background: '#eef3fa', padding: 8 }} />
          <details style={{ fontFamily: 'var(--font-system)', fontSize: 12, color: '#52749a', marginTop: 8 }}>
            <summary style={{ cursor: 'pointer' }}>Can&apos;t scan? Enter the secret manually</summary>
            <code style={{ display: 'block', marginTop: 8, padding: 10, background: '#1a2f4e', borderRadius: 8, color: '#eef3fa', fontSize: 13, wordBreak: 'break-all' }}>
              {setupData.otpauthUrl.match(/secret=([^&]+)/)?.[1] || ''}
            </code>
          </details>

          <form onSubmit={enable} style={{ marginTop: 18 }}>
            <div style={labelStyle}>3. Enter the 6-digit code your app shows:</div>
            <input
              autoFocus
              required
              inputMode="numeric"
              maxLength={7}  // allow a space mid-code
              pattern="\d{3}\s?\d{3}"
              placeholder="123 456"
              value={code}
              onChange={e => setCode(e.target.value)}
              style={{ ...inputStyle, fontFamily: 'ui-monospace, monospace', letterSpacing: 4, fontSize: 18, textAlign: 'center', marginTop: 8 }}
            />
            <button type="submit" disabled={(stage as string) === 'verifying' || code.replace(/\s/g, '').length !== 6} style={{ ...primaryBtn, marginTop: 14, opacity: (stage as string) === 'verifying' ? 0.5 : 1 }}>
              {(stage as string) === 'verifying' ? 'Verifying…' : 'Verify and enable'}
            </button>
          </form>
        </section>
      )}

      {/* Enabled — show backup codes once, then collapse to status */}
      {stage === 'enabled' && enableResult && (
        <section style={{ ...sectionStyle, borderColor: 'rgba(16,185,129,0.4)' }}>
          <div style={{ fontFamily: 'var(--font-system)', fontSize: 14, color: '#10b981', fontWeight: 700, marginBottom: 12 }}>
            ✓ 2FA enabled
          </div>
          <p style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#8ea8c5', lineHeight: 1.5, marginBottom: 14 }}>
            <strong style={{ color: '#f59e0b' }}>Save these backup codes now.</strong> They are shown only once. Each can be used once if you lose your authenticator.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>
            {enableResult.backupCodes.map(c => (
              <div key={c} style={{ padding: '8px 10px', background: '#1a2f4e', borderRadius: 6, color: '#eef3fa', textAlign: 'center', letterSpacing: 1 }}>
                {c}
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              const text = enableResult.backupCodes.join('\n')
              navigator.clipboard?.writeText(text).then(() => alert('Codes copied to clipboard'))
            }}
            style={{ ...secondaryBtn, marginTop: 14 }}
          >
            Copy codes to clipboard
          </button>
        </section>
      )}

      {/* Already enabled (no fresh backup codes to show) — disable flow */}
      {stage === 'enabled' && !enableResult && enrolled && (
        <section style={sectionStyle}>
          <div style={{ fontFamily: 'var(--font-system)', fontSize: 14, color: '#10b981', fontWeight: 700, marginBottom: 12 }}>
            ✓ 2FA is on
          </div>
          <form onSubmit={disable}>
            <div style={labelStyle}>Disable 2FA — confirm your password</div>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ ...inputStyle, marginTop: 8 }}
            />
            <button type="submit" disabled={(stage as string) === 'disabling' || !password} style={{ ...dangerBtn, marginTop: 14, opacity: (stage as string) === 'disabling' ? 0.5 : 1 }}>
              {(stage as string) === 'disabling' ? 'Disabling…' : 'Disable 2FA'}
            </button>
          </form>
        </section>
      )}

      {error && (
        <div role="alert" style={{ marginTop: 16, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 10, padding: '10px 14px', fontFamily: 'var(--font-system)', fontSize: 13 }}>
          {error}
        </div>
      )}
    </div>
  )
}

const sectionStyle: React.CSSProperties = {
  background: '#152641',
  borderRadius: 14,
  padding: 18,
  marginBottom: 16,
  border: '0.5px solid rgba(255,255,255,0.07)',
}
const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-system)',
  fontSize: 11,
  color: '#52749a',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}
const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#1a2f4e',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '12px 14px',
  color: '#eef3fa',
  fontFamily: 'var(--font-system)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}
const primaryBtn: React.CSSProperties = {
  width: '100%',
  padding: '12px 0',
  borderRadius: 10,
  background: '#2563eb',
  border: 'none',
  color: '#fff',
  fontFamily: 'var(--font-system)',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
}
const secondaryBtn: React.CSSProperties = {
  ...primaryBtn,
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.13)',
  color: '#eef3fa',
}
const dangerBtn: React.CSSProperties = {
  ...primaryBtn,
  background: '#ef4444',
}
