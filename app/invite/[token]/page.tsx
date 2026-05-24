'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'
import Link from 'next/link'

interface InviteInfo {
  organizationName: string
  organizationSlug: string
  email: string
  role: string
  expiresAt: string
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const { data: session, status, update } = useSession()
  const router = useRouter()

  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then(r => r.json().then(d => ({ ok: r.ok, status: r.status, data: d })))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data.error || 'Invite not found')
        } else {
          setInvite(data.invite)
        }
      })
      .catch(() => setError('Failed to load invite'))
      .finally(() => setLoading(false))
  }, [token])

  const accept = async () => {
    setAccepting(true)
    setError(null)
    try {
      const res = await fetch(`/api/invites/${token}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to accept')
      // Refresh JWT so the new membership appears in session.user.organizations
      await update?.()
      router.replace('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
      setAccepting(false)
    }
  }

  if (loading) {
    return <Frame><div style={{ color: '#52749a', fontSize: 13, fontFamily: 'var(--font-system)' }}>Loading invite…</div></Frame>
  }

  if (error || !invite) {
    return (
      <Frame>
        <h1 style={titleStyle}>Invite unavailable</h1>
        <p style={{ color: '#8ea8c5', fontSize: 14, fontFamily: 'var(--font-system)', textAlign: 'center', marginBottom: 16 }}>
          {error || 'This invitation could not be loaded.'}
        </p>
        <Link href="/login" style={ctaStyle}>Go to sign in</Link>
      </Frame>
    )
  }

  // Signed-out users: bounce through login with the invite path as callback.
  if (status !== 'authenticated') {
    return (
      <Frame>
        <h1 style={titleStyle}>You&apos;ve been invited</h1>
        <p style={{ color: '#8ea8c5', fontSize: 14, fontFamily: 'var(--font-system)', textAlign: 'center', marginBottom: 16, lineHeight: 1.5 }}>
          Join <strong style={{ color: '#eef3fa' }}>{invite.organizationName}</strong> on Cortexx as a <strong style={{ color: '#eef3fa' }}>{invite.role}</strong>.
        </p>
        <p style={{ color: '#52749a', fontSize: 12, fontFamily: 'var(--font-system)', textAlign: 'center', marginBottom: 20 }}>
          Sign in or create an account for {invite.email} to continue.
        </p>
        <button onClick={() => signIn(undefined, { callbackUrl: `/invite/${token}` })} style={ctaStyle}>
          Sign in
        </button>
        <Link href={`/register?callbackUrl=/invite/${token}`} style={{ ...ctaStyle, background: 'transparent', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)', marginTop: 8 }}>
          Create account
        </Link>
      </Frame>
    )
  }

  // Signed in but with a different email
  const sessionEmail = (session?.user as { email?: string })?.email?.toLowerCase()
  if (sessionEmail !== invite.email.toLowerCase()) {
    return (
      <Frame>
        <h1 style={titleStyle}>Different account</h1>
        <p style={{ color: '#8ea8c5', fontSize: 14, fontFamily: 'var(--font-system)', textAlign: 'center', marginBottom: 16, lineHeight: 1.5 }}>
          This invite is for <strong style={{ color: '#eef3fa' }}>{invite.email}</strong> but you&apos;re signed in as <strong style={{ color: '#eef3fa' }}>{sessionEmail}</strong>.
        </p>
        <button onClick={() => signIn(undefined, { callbackUrl: `/invite/${token}` })} style={ctaStyle}>
          Switch account
        </button>
      </Frame>
    )
  }

  return (
    <Frame>
      <h1 style={titleStyle}>Join {invite.organizationName}</h1>
      <p style={{ color: '#8ea8c5', fontSize: 14, fontFamily: 'var(--font-system)', textAlign: 'center', marginBottom: 24, lineHeight: 1.5 }}>
        You&apos;ve been invited to join as a <strong style={{ color: '#eef3fa' }}>{invite.role}</strong>.
      </p>
      {error && (
        <div role="alert" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 10, padding: '10px 14px', fontFamily: 'var(--font-system)', fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}
      <button onClick={accept} disabled={accepting} style={{ ...ctaStyle, opacity: accepting ? 0.5 : 1 }}>
        {accepting ? 'Joining…' : 'Accept invitation'}
      </button>
      <Link href="/dashboard" style={{ ...ctaStyle, background: 'transparent', color: '#52749a', border: '1px solid rgba(255,255,255,0.1)', marginTop: 8 }}>
        Not now
      </Link>
    </Frame>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400, background: '#152641', borderRadius: 18, padding: 32, border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {children}
      </div>
    </div>
  )
}

const titleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: '#eef3fa',
  letterSpacing: '-0.02em',
  fontFamily: 'var(--font-system)',
  margin: '0 0 4px',
  textAlign: 'center',
}

const ctaStyle: React.CSSProperties = {
  display: 'block',
  textAlign: 'center',
  padding: '13px 0',
  borderRadius: 12,
  background: '#f59e0b',
  border: 'none',
  color: '#fff',
  fontFamily: 'var(--font-system)',
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
  textDecoration: 'none',
  width: '100%',
}
