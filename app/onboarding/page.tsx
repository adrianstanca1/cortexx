'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'

export default function OnboardingPage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const params = useSearchParams()
  const callbackUrl = params.get('callbackUrl') || '/dashboard'

  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  // If the user already has at least one org, skip onboarding entirely.
  useEffect(() => {
    if (!session?.user) return
    type OrgsUser = { organizations?: { id: string }[] }
    const orgs = (session.user as OrgsUser).organizations || []
    if (orgs.length > 0) {
      router.replace(callbackUrl)
      return
    }
    setChecked(true)
  }, [session, router, callbackUrl])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create workspace')
      // Refresh the JWT so it picks up the new membership.
      await update?.()
      router.replace(callbackUrl)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
      setBusy(false)
    }
  }

  if (!checked) {
    return (
      <div style={{ background: '#06101e', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>Loading…</div>
      </div>
    )
  }

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>Step 1 of 1</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)', margin: 0 }}>
          Name your workspace
        </h1>
        <p style={{ fontSize: 14, color: '#8ea8c5', marginBottom: 4, fontFamily: 'var(--font-system)', lineHeight: 1.5 }}>
          This is what your team and clients will see. You can change it later in settings.
        </p>

        <label style={labelStyle}>Workspace name</label>
        <input
          autoFocus
          maxLength={100}
          required
          placeholder="e.g. Patterson Construction"
          value={name}
          onChange={e => setName(e.target.value)}
          style={inputStyle}
        />

        {error && (
          <div role="alert" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 10, padding: '10px 14px', fontFamily: 'var(--font-system)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !name.trim()}
          style={{ marginTop: 4, padding: '14px 0', borderRadius: 14, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: busy || !name.trim() ? 0.5 : 1 }}
        >
          {busy ? 'Creating workspace…' : 'Create workspace'}
        </button>

        <p style={{ fontSize: 12, color: '#52749a', marginTop: 12, fontFamily: 'var(--font-system)' }}>
          You&apos;ll get a 14-day free trial of the Pro plan. No card required.
        </p>
      </form>
    </div>
  )
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
  background: '#152641',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  padding: '13px 16px',
  color: '#eef3fa',
  fontFamily: 'var(--font-system)',
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
}
