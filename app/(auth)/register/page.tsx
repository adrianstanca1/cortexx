'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Registration failed')
      setLoading(false)
      return
    }
    // Auto-sign-in after register
    const signInRes = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (signInRes?.error) {
      setError('Account created, but sign-in failed. Try logging in manually.')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <form onSubmit={onSubmit} style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)', marginBottom: 4 }}>
          Create your account
        </h1>
        <p style={{ fontSize: 13, color: '#8ea8c5', marginBottom: 8, fontFamily: 'var(--font-system)' }}>
          Cortexx construction management
        </p>

        <label style={labelStyle}>Name (optional)</label>
        <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} autoComplete="name" />

        <label style={labelStyle}>Email</label>
        <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>Password (8+ characters)</label>
        <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />

        {error && (
          <div role="alert" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 10, padding: '10px 14px', fontFamily: 'var(--font-system)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email || password.length < 8}
          style={{ marginTop: 4, padding: '14px 0', borderRadius: 14, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: loading || !email || password.length < 8 ? 0.5 : 1 }}
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#8ea8c5', fontFamily: 'var(--font-system)', marginTop: 12 }}>
          Already have one?{' '}
          <Link href="/login" style={{ color: '#f59e0b', textDecoration: 'none', fontWeight: 600 }}>
            Sign in
          </Link>
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
