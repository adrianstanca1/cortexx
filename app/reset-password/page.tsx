'use client'

import { FormEvent, Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ResetForm() {
  const search = useSearchParams()
  const token = search.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (password.length < 8 || password.length > 200) {
      setError('Use a password between 8 and 200 characters.')
      return
    }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) { setError(result.error || 'Could not reset password.'); return }
      setDone(true)
      setPassword(''); setConfirm('')
    } catch {
      setError('Could not reach Cortex Construct. Try again.')
    } finally { setBusy(false) }
  }

  return (
    <main style={{ background: '#090B0D', minHeight: '100dvh', color: '#F5F7F2',
      display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <section style={{ width: '100%', maxWidth: 380 }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>Reset your Cortex Construct password</h1>
        {done ? <>
          <p>Your password has been changed. Return to Cortex Construct on your phone and sign in.</p>
          <Link href="/login" style={{ color: '#D7FF3F' }}>Go to sign in</Link>
        </> : !/^[a-f0-9]{64}$/.test(token) ? <>
          <p>This reset link is invalid or incomplete. Request another from the Cortex Construct app.</p>
          <Link href="/forgot-password" style={{ color: '#D7FF3F' }}>Request a new reset link</Link>
        </> : <form onSubmit={submit} style={{ display: 'grid', gap: 14, marginTop: 24 }}>
          <label htmlFor="new-password">New password (8+ characters)</label>
          <input id="new-password" type="password" autoComplete="new-password"
            minLength={8} maxLength={200} required value={password} onChange={e => setPassword(e.target.value)}
            style={inputStyle} />
          <label htmlFor="confirm-password">Confirm new password</label>
          <input id="confirm-password" type="password" autoComplete="new-password" required
            value={confirm} onChange={e => setConfirm(e.target.value)} style={inputStyle} />
          {error && <p role="alert" style={{ color: '#FF6565' }}>{error}</p>}
          <button type="submit" disabled={busy} style={{ padding: 14, border: 0, borderRadius: 12,
            background: '#D7FF3F', color: '#090B0D', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
            {busy ? 'Resetting password…' : 'Set new password'}
          </button>
        </form>}
      </section>
    </main>
  )
}

const inputStyle = { border: '1px solid #293139', borderRadius: 12, padding: 14,
  background: '#171D22', color: '#F5F7F2', fontSize: 16 }

export default function ResetPasswordPage() {
  return <Suspense fallback={<div style={{ minHeight: '100dvh', background: '#090B0D' }} />}>
    <ResetForm />
  </Suspense>
}
