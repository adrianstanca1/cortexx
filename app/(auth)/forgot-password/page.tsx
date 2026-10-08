'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'

/** The same email-recovery API is used by the Expo sign-in screen. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const response = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(data.error || 'Password recovery is temporarily unavailable. Please try again later.')
        return
      }
      setDone(true)
    } catch {
      setError('Unable to reach Cortex Construct. Check your connection and try again.')
    } finally { setBusy(false) }
  }

  return <main style={{ background: 'var(--bg0)', minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
    <section style={{ width: '100%', maxWidth: 390, color: 'var(--t1)', fontFamily: 'var(--font-system)' }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Forgot your password?</h1>
      <p style={{ color: 'var(--t2)', fontSize: 14, lineHeight: 1.6, marginBottom: 22 }}>
        Use the same email address as your Cortex Construct web or mobile account.
      </p>
      {done ? <p role="status" style={{ color: 'var(--t1)', fontSize: 14, lineHeight: 1.6 }}>
        If the address is registered, a reset link will be emailed to you. Check your inbox and spam folder.
      </p> : <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
        <label htmlFor="recovery-email">Email address</label>
        <input id="recovery-email" type="email" autoComplete="email" required maxLength={254}
          autoCapitalize="none" value={email} onChange={event => setEmail(event.target.value)}
          style={{ padding: 14, border: '1px solid var(--border)', background: 'var(--surface-raised)',
            borderRadius: 12, color: 'var(--t1)', fontSize: 16 }} />
        {error && <p role="alert" style={{ color: '#ff7070', fontSize: 13 }}>{error}</p>}
        <button type="submit" disabled={busy} style={{ padding: 14, border: 0, borderRadius: 12,
          background: '#d7ff3f', color: '#090b0d', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          {busy ? 'Checking availability…' : 'Send reset link'}
        </button>
      </form>}
      <p style={{ marginTop: 24 }}><Link href="/login" style={{ color: '#d7ff3f' }}>Back to sign in</Link></p>
    </section>
  </main>
}
