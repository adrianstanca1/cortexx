'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { IcChevL } from '@/components/ui/Icons'

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession()
  const router = useRouter()

  const [name, setName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameMsg, setNameMsg] = useState<string | null>(null)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirmPw, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (session?.user?.name && !name) setName(session.user.name)
  }, [session?.user?.name, name])

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || name.trim() === session?.user?.name) return
    setSavingName(true)
    setNameMsg(null)
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) throw new Error('Failed to update name')
      await updateSession?.()
      setNameMsg('Name updated')
      setTimeout(() => setNameMsg(null), 2500)
    } catch (e) {
      setNameMsg(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSavingName(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null); setSuccess(null)
    if (next.length < 8) return setError('New password must be at least 8 characters')
    if (next !== confirmPw) return setError('Passwords do not match')
    setSaving(true)
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed')
      }
      setSuccess('Password updated')
      setCurrent(''); setNext(''); setConfirm('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', padding: '20px', paddingBottom: 100 }}>
      <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 12 }}>
        <IcChevL size={18} color="#52749a" />
        <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>Back</span>
      </Link>

      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)', marginBottom: 4 }}>
        Account settings
      </h1>
      <p style={{ fontSize: 13, color: '#8ea8c5', fontFamily: 'var(--font-system)', marginBottom: 24 }}>
        {session?.user?.email || ''}
      </p>

      {/* Profile */}
      <form onSubmit={saveName} style={{ background: '#152641', borderRadius: 14, padding: 16, marginBottom: 16, border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={labelStyle}>Profile</div>
        <div style={{ fontFamily: 'var(--font-system)', fontSize: 12, color: '#8ea8c5' }}>{session?.user?.email}</div>
        {session?.user?.role && (
          <div style={{ display: 'inline-block', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: 0.5, alignSelf: 'flex-start' }}>
            {session.user.role}
          </div>
        )}
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={100}
          style={inputStyle}
        />
        {nameMsg && (
          <div role="status" style={{ background: nameMsg === 'Name updated' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${nameMsg === 'Name updated' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, color: nameMsg === 'Name updated' ? '#10b981' : '#ef4444', borderRadius: 10, padding: '8px 14px', fontFamily: 'var(--font-system)', fontSize: 12 }}>
            {nameMsg}
          </div>
        )}
        <button
          type="submit"
          disabled={savingName || !name.trim() || name.trim() === session?.user?.name}
          style={{ padding: '10px 0', borderRadius: 10, background: '#2563eb', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: savingName || !name.trim() || name.trim() === session?.user?.name ? 0.5 : 1 }}
        >
          {savingName ? 'Saving…' : 'Save name'}
        </button>
      </form>

      {/* Password change */}
      <form onSubmit={submit} style={{ background: '#152641', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, border: '0.5px solid rgba(255,255,255,0.07)' }}>
        <div style={labelStyle}>Change password</div>

        <input
          type="password"
          placeholder="Current password"
          autoComplete="current-password"
          required
          value={current}
          onChange={e => setCurrent(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="New password (8+ characters)"
          autoComplete="new-password"
          required
          minLength={8}
          value={next}
          onChange={e => setNext(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Confirm new password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPw}
          onChange={e => setConfirm(e.target.value)}
          style={inputStyle}
        />

        {error && (
          <div role="alert" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 10, padding: '10px 14px', fontFamily: 'var(--font-system)', fontSize: 13 }}>
            {error}
          </div>
        )}
        {success && (
          <div role="status" style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', borderRadius: 10, padding: '10px 14px', fontFamily: 'var(--font-system)', fontSize: 13 }}>
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={saving || !current || next.length < 8 || next !== confirmPw}
          style={{ padding: '12px 0', borderRadius: 12, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving || !current || next.length < 8 || next !== confirmPw ? 0.5 : 1 }}
        >
          {saving ? 'Saving…' : 'Update password'}
        </button>
      </form>

      {/* Export data */}
      <section style={{ background: '#152641', borderRadius: 14, padding: 16, marginTop: 16, border: '0.5px solid rgba(255,255,255,0.07)' }}>
        <div style={labelStyle}>Export data (CSV)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
          {(['projects', 'tasks', 'invoices', 'team', 'timeentries'] as const).map(t => (
            <a
              key={t}
              href={`/api/export/${t}`}
              download
              style={{ display: 'block', padding: '10px 0', textAlign: 'center', borderRadius: 10, background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', color: '#eef3fa', fontFamily: 'var(--font-system)', fontSize: 13, fontWeight: 600, textDecoration: 'none', textTransform: 'capitalize' }}
            >
              {t}
            </a>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <button
          onClick={() => { if (window.confirm('Sign out?')) signOut({ callbackUrl: '/login' }) }}
          style={{ width: '100%', padding: '12px 0', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontFamily: 'var(--font-system)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          Sign out
        </button>
      </section>
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
