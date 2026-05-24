'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { IcChevL } from '@/components/ui/Icons'

// VAPID public key needs base64url → Uint8Array conversion for the SW.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const buffer = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession()
  const router = useRouter()

  // ─── Push notifications ───
  const [pushSupported, setPushSupported] = useState(false)
  const [pushPermission, setPushPermission] = useState<'default' | 'granted' | 'denied'>('default')
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushConfigured, setPushConfigured] = useState(false)
  const [pushVapidKey, setPushVapidKey] = useState<string | null>(null)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setPushSupported(supported)
    if (!supported) return
    setPushPermission(Notification.permission as 'default' | 'granted' | 'denied')
    fetch('/api/push/subscribe').then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setPushConfigured(!!d.configured); setPushVapidKey(d.publicKey || null) }
    }).catch(() => {})
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription())
      .then(sub => setPushSubscribed(!!sub))
      .catch(() => {})
  }, [])

  const subscribePush = useCallback(async () => {
    setPushBusy(true)
    setPushMsg(null)
    try {
      if (!pushVapidKey) throw new Error('No VAPID public key configured on the server')
      const permission = await Notification.requestPermission()
      setPushPermission(permission as 'default' | 'granted' | 'denied')
      if (permission !== 'granted') throw new Error('Notification permission denied')
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(pushVapidKey) })
      const json = sub.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } }
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Subscribe failed')
      setPushSubscribed(true)
      setPushMsg('Subscribed — you\'ll get notifications on this device.')
    } catch (e) {
      setPushMsg(e instanceof Error ? e.message : 'Failed to subscribe')
    } finally { setPushBusy(false) }
  }, [pushVapidKey])

  const unsubscribePush = useCallback(async () => {
    setPushBusy(true)
    setPushMsg(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setPushSubscribed(false)
      setPushMsg('Unsubscribed.')
    } catch (e) {
      setPushMsg(e instanceof Error ? e.message : 'Failed to unsubscribe')
    } finally { setPushBusy(false) }
  }, [])

  const sendTestPush = useCallback(async () => {
    setPushBusy(true)
    setPushMsg(null)
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        if (json.code === 'PUSH_NOT_CONFIGURED') setPushMsg('Server hasn\'t got VAPID keys configured yet — ask an admin to set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.')
        else setPushMsg(json.error || 'Failed')
        return
      }
      setPushMsg(`Delivered to ${json.delivered} device${json.delivered === 1 ? '' : 's'}${json.pruned ? `, pruned ${json.pruned} stale` : ''}`)
    } catch (e) {
      setPushMsg(e instanceof Error ? e.message : 'Failed')
    } finally { setPushBusy(false) }
  }, [])

  // ─── Notification preferences ───
  interface PrefsState {
    tasksPush: boolean; tasksEmail: boolean
    safetyPush: boolean; safetyEmail: boolean
    invoicesPush: boolean; invoicesEmail: boolean
    announcementsPush: boolean; announcementsEmail: boolean
    weeklyDigest: boolean
  }
  const [prefs, setPrefs] = useState<PrefsState | null>(null)
  useEffect(() => {
    fetch('/api/notifications/preferences')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.preferences) setPrefs(d.preferences) })
      .catch(() => {})
  }, [])

  const togglePref = useCallback(async (field: keyof PrefsState, value: boolean) => {
    if (!prefs) return
    setPrefs({ ...prefs, [field]: value })
    await fetch('/api/notifications/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    }).catch(() => {})
  }, [prefs])

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
    <div style={{ background: '#06101e', minHeight: '100dvh', padding: '20px 20px 100px 60px' }}>
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

      {/* Workspace settings */}
      <section style={{ background: '#152641', borderRadius: 14, padding: 16, marginTop: 16, border: '0.5px solid rgba(255,255,255,0.07)' }}>
        <div style={labelStyle}>Workspace</div>
        <Link
          href="/settings/organization"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', marginTop: 10, background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#eef3fa', fontFamily: 'var(--font-system)', fontSize: 14, textDecoration: 'none' }}
        >
          <span>Team members &amp; invites</span>
          <span style={{ color: '#52749a' }}>→</span>
        </Link>
      </section>

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

      {/* Push notifications */}
      <section style={{ background: '#152641', borderRadius: 14, padding: 16, marginTop: 16, border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={labelStyle}>Notifications</div>
        <p style={{ fontFamily: 'var(--font-system)', fontSize: 12, color: '#8ea8c5', margin: 0, lineHeight: 1.5 }}>
          Get push notifications on this device for new tasks, overdue invoices and site events. Works in the background even when the app is closed.
        </p>

        {!pushSupported && (
          <div style={{ fontFamily: 'var(--font-system)', fontSize: 12, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '8px 12px' }}>
            This browser doesn&apos;t support push notifications. Try Chrome, Edge or Firefox.
          </div>
        )}

        {pushSupported && !pushConfigured && (
          <div style={{ fontFamily: 'var(--font-system)', fontSize: 12, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '8px 12px' }}>
            Push is not configured on the server yet. An admin needs to set <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 4px', borderRadius: 3 }}>VAPID_PUBLIC_KEY</code> and <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 4px', borderRadius: 3 }}>VAPID_PRIVATE_KEY</code> env vars.
          </div>
        )}

        {pushSupported && pushPermission === 'denied' && (
          <div style={{ fontFamily: 'var(--font-system)', fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '8px 12px' }}>
            Notification permission is blocked. Re-enable it in your browser&apos;s site settings.
          </div>
        )}

        {pushSupported && (
          <div style={{ display: 'flex', gap: 8 }}>
            {pushSubscribed ? (
              <button
                type="button"
                onClick={unsubscribePush}
                disabled={pushBusy}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontFamily: 'var(--font-system)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: pushBusy ? 0.5 : 1 }}
              >
                {pushBusy ? 'Working…' : 'Unsubscribe'}
              </button>
            ) : (
              <button
                type="button"
                onClick={subscribePush}
                disabled={pushBusy || !pushConfigured || pushPermission === 'denied'}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: '#2563eb', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: pushBusy || !pushConfigured || pushPermission === 'denied' ? 0.5 : 1 }}
              >
                {pushBusy ? 'Working…' : 'Enable notifications'}
              </button>
            )}
            {pushSubscribed && (
              <button
                type="button"
                onClick={sendTestPush}
                disabled={pushBusy}
                style={{ padding: '10px 14px', borderRadius: 10, background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', color: '#eef3fa', fontFamily: 'var(--font-system)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: pushBusy ? 0.5 : 1 }}
              >
                Send test
              </button>
            )}
          </div>
        )}

        {pushMsg && (
          <div role="status" style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.3)', color: '#93c5fd', borderRadius: 10, padding: '8px 12px', fontFamily: 'var(--font-system)', fontSize: 12 }}>
            {pushMsg}
          </div>
        )}
      </section>

      {/* Notification preferences */}
      {prefs && (
        <section style={{ background: '#152641', borderRadius: 14, padding: 16, marginTop: 16, border: '0.5px solid rgba(255,255,255,0.07)' }}>
          <div style={labelStyle}>What to notify me about</div>
          <p style={{ fontFamily: 'var(--font-system)', fontSize: 12, color: '#8ea8c5', margin: '8px 0 12px', lineHeight: 1.5 }}>
            Pick the categories you want each channel for. Push is per device (above); email goes to {session?.user?.email}.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px', gap: '8px 12px', alignItems: 'center', fontFamily: 'var(--font-system)', fontSize: 12 }}>
            <div></div>
            <div style={{ color: '#52749a', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>Push</div>
            <div style={{ color: '#52749a', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>Email</div>

            {([
              ['Tasks assigned to me', 'tasksPush', 'tasksEmail'],
              ['Safety incidents', 'safetyPush', 'safetyEmail'],
              ['Overdue invoices', 'invoicesPush', 'invoicesEmail'],
              ['Announcements', 'announcementsPush', 'announcementsEmail'],
            ] as const).map(([label, pushKey, emailKey]) => (
              <>
                <div key={`l-${pushKey}`} style={{ color: '#eef3fa' }}>{label}</div>
                <input
                  key={`p-${pushKey}`}
                  type="checkbox"
                  checked={prefs[pushKey]}
                  onChange={e => togglePref(pushKey, e.target.checked)}
                  style={{ justifySelf: 'center', cursor: 'pointer', accentColor: '#2563eb', width: 18, height: 18 }}
                />
                <input
                  key={`e-${emailKey}`}
                  type="checkbox"
                  checked={prefs[emailKey]}
                  onChange={e => togglePref(emailKey, e.target.checked)}
                  style={{ justifySelf: 'center', cursor: 'pointer', accentColor: '#2563eb', width: 18, height: 18 }}
                />
              </>
            ))}

            <div style={{ color: '#eef3fa', gridColumn: '1 / -1', marginTop: 10, paddingTop: 10, borderTop: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Weekly digest email</span>
              <input
                type="checkbox"
                checked={prefs.weeklyDigest}
                onChange={e => togglePref('weeklyDigest', e.target.checked)}
                style={{ cursor: 'pointer', accentColor: '#2563eb', width: 18, height: 18 }}
              />
            </div>
          </div>
        </section>
      )}

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
