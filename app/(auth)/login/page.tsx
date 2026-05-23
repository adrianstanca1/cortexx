'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function LoginForm() {
  const router = useRouter()
  const search = useSearchParams()
  const callbackUrl = search.get('callbackUrl') || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await signIn('credentials', { email, password, redirect: false, callbackUrl })
    setLoading(false)
    if (res?.error) {
      setError('Invalid email or password')
      return
    }
    router.push(callbackUrl)
    router.refresh()
  }

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <form onSubmit={onSubmit} style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)', marginBottom: 4 }}>
          Sign in to Cortexx
        </h1>
        <p style={{ fontSize: 13, color: '#8ea8c5', marginBottom: 8, fontFamily: 'var(--font-system)' }}>
          Mobile-first construction management
        </p>

        <label style={labelStyle}>Email</label>
        <input
          type="email"
          autoFocus
          autoComplete="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={inputStyle}
        />

        <label style={labelStyle}>Password</label>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={inputStyle}
        />

        {error && (
          <div role="alert" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 10, padding: '10px 14px', fontFamily: 'var(--font-system)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email || !password}
          style={{ marginTop: 4, padding: '14px 0', borderRadius: 14, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: loading || !email || !password ? 0.5 : 1 }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#8ea8c5', fontFamily: 'var(--font-system)', marginTop: 12 }}>
          New?{' '}
          <Link href="/register" style={{ color: '#f59e0b', textDecoration: 'none', fontWeight: 600 }}>
            Create an account
          </Link>
        </p>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ background: '#06101e', minHeight: '100dvh' }} />}>
      <LoginForm />
    </Suspense>
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
