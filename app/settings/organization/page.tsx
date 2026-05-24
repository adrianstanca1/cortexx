'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { IcChevL } from '@/components/ui/Icons'

interface Member {
  id: string
  userId: string
  email: string
  name: string | null
  role: 'owner' | 'admin' | 'member' | 'viewer' | string
  joinedAt: string
}

interface Invite {
  id: string
  email: string
  role: string
  expiresAt: string
}

const RANK: Record<string, number> = { viewer: 0, member: 1, admin: 2, owner: 3 }

export default function OrganizationSettingsPage() {
  const { data: session } = useSession()
  type SessionOrg = { id: string; slug: string; name: string; role: string }
  const orgs = ((session?.user as { organizations?: SessionOrg[] })?.organizations) || []
  const activeOrg = orgs[0] // resolved server-side via cookie elsewhere; here we display the first

  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteMsg, setInviteMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!activeOrg) return
    setLoading(true)
    try {
      const [mRes, iRes] = await Promise.all([
        fetch(`/api/orgs/${activeOrg.id}/members`),
        fetch(`/api/orgs/${activeOrg.id}/invites`),
      ])
      if (mRes.ok) {
        const data = await mRes.json()
        setMembers(data.members || [])
        setCanManage(data.canManage || false)
      }
      if (iRes.ok) {
        const data = await iRes.json()
        setInvites(data.invites || [])
      } else if (iRes.status === 403) {
        setInvites([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [activeOrg])

  useEffect(() => { load() }, [load])

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeOrg || !inviteEmail.trim()) return
    setInviteBusy(true)
    setInviteMsg(null)
    try {
      const res = await fetch(`/api/orgs/${activeOrg.id}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send invite')
      setInviteMsg(`Invite sent to ${inviteEmail.trim()}`)
      setInviteEmail('')
      await load()
    } catch (err) {
      setInviteMsg(err instanceof Error ? err.message : 'Failed')
    } finally {
      setInviteBusy(false)
    }
  }

  const changeRole = async (memberId: string, role: string) => {
    if (!activeOrg) return
    const res = await fetch(`/api/orgs/${activeOrg.id}/members/${memberId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    if (res.ok) await load()
  }

  const removeMember = async (memberId: string, email: string) => {
    if (!activeOrg) return
    if (!window.confirm(`Remove ${email} from this workspace?`)) return
    const res = await fetch(`/api/orgs/${activeOrg.id}/members/${memberId}`, { method: 'DELETE' })
    if (res.ok) await load()
    else {
      const data = await res.json().catch(() => ({}))
      window.alert(data.error || 'Failed to remove member')
    }
  }

  if (!activeOrg) {
    return (
      <div style={{ background: '#06101e', minHeight: '100dvh', padding: 24, color: '#8ea8c5', fontFamily: 'var(--font-system)' }}>
        No active workspace. <Link href="/onboarding" style={{ color: '#f59e0b' }}>Create one</Link>.
      </div>
    )
  }

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', padding: '20px 20px 100px 60px' }}>
      <Link href="/settings" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 12 }}>
        <IcChevL size={18} color="#52749a" />
        <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>Settings</span>
      </Link>

      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)', marginBottom: 4 }}>
        {activeOrg.name}
      </h1>
      <p style={{ fontSize: 13, color: '#8ea8c5', fontFamily: 'var(--font-system)', marginBottom: 24 }}>
        {activeOrg.slug} · You are {activeOrg.role}
      </p>

      {/* Billing */}
      <BillingSection organizationId={activeOrg.id} canManage={canManage} />

      {/* Quick links */}
      {canManage && (
        <Link
          href="/settings/audit-log"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', marginBottom: 16, background: '#152641', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 14, color: '#eef3fa', fontFamily: 'var(--font-system)', fontSize: 14, textDecoration: 'none' }}
        >
          <span>Audit log</span>
          <span style={{ color: '#52749a' }}>→</span>
        </Link>
      )}

      {/* Members */}
      <section style={sectionStyle}>
        <div style={labelStyle}>Team members ({members.length})</div>
        {loading ? (
          <div style={{ color: '#52749a', fontSize: 12, fontFamily: 'var(--font-system)' }}>Loading…</div>
        ) : error ? (
          <div style={{ color: '#ef4444', fontSize: 13, fontFamily: 'var(--font-system)' }}>{error}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {members.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#1a2f4e', borderRadius: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-system)', fontSize: 14, color: '#eef3fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.name || m.email}
                  </div>
                  <div style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#8ea8c5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.email}
                  </div>
                </div>
                {canManage && m.role !== 'owner' ? (
                  <select
                    value={m.role}
                    onChange={e => changeRole(m.id, e.target.value)}
                    style={{ background: '#06101e', color: '#eef3fa', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', fontFamily: 'var(--font-system)', fontSize: 12 }}
                  >
                    <option value="admin">admin</option>
                    <option value="member">member</option>
                    <option value="viewer">viewer</option>
                  </select>
                ) : (
                  <div style={{ fontFamily: 'var(--font-system)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: m.role === 'owner' ? '#f59e0b' : '#52749a' }}>
                    {m.role}
                  </div>
                )}
                {canManage && m.role !== 'owner' && (
                  <button
                    onClick={() => removeMember(m.id, m.email)}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontFamily: 'var(--font-system)', fontSize: 12, padding: '4px 8px' }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Invite */}
      {canManage && (
        <section style={sectionStyle}>
          <div style={labelStyle}>Invite a teammate</div>
          <form onSubmit={sendInvite} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              type="email"
              required
              placeholder="email@example.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value as 'admin' | 'member' | 'viewer')} style={{ ...inputStyle, width: 110, padding: '12px 10px' }}>
              <option value="admin">admin</option>
              <option value="member">member</option>
              <option value="viewer">viewer</option>
            </select>
            <button
              type="submit"
              disabled={inviteBusy || !inviteEmail.trim()}
              style={{ padding: '0 18px', borderRadius: 10, background: '#2563eb', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: inviteBusy || !inviteEmail.trim() ? 0.5 : 1 }}
            >
              {inviteBusy ? '…' : 'Invite'}
            </button>
          </form>
          {inviteMsg && (
            <div role="status" style={{ marginTop: 10, fontFamily: 'var(--font-system)', fontSize: 12, color: inviteMsg.startsWith('Invite sent') ? '#10b981' : '#ef4444' }}>
              {inviteMsg}
            </div>
          )}

          {invites.length > 0 && (
            <>
              <div style={{ ...labelStyle, marginTop: 18 }}>Pending invites ({invites.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {invites.map(i => (
                  <div key={i.id} style={{ padding: '8px 12px', background: '#1a2f4e', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#eef3fa' }}>{i.email}</div>
                      <div style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a' }}>{i.role} · expires {new Date(i.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}

const sectionStyle: React.CSSProperties = {
  background: '#152641',
  borderRadius: 14,
  padding: 16,
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

// Suppress unused-var lint for RANK (kept for future role-sort use)
void RANK

const PLANS = [
  { key: 'starter', name: 'Starter', price: '£29/mo', features: ['5 users', '10 projects', '5 GB'] },
  { key: 'pro', name: 'Pro', price: '£79/mo', features: ['20 users', '50 projects', '50 GB', 'AI tools'] },
  { key: 'enterprise', name: 'Enterprise', price: 'Contact us', features: ['Unlimited users', 'SAML SSO', 'Audit log retention'] },
]

function BillingSection({ organizationId, canManage }: { organizationId: string; canManage: boolean }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const startCheckout = async (planKey: string) => {
    setBusy(planKey)
    setMsg(null)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, plan: planKey }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.code === 'STRIPE_NOT_CONFIGURED') {
          setMsg('Billing isn\'t configured yet. Ask an admin to set the Stripe env vars.')
        } else if (data.code === 'PRICE_NOT_SET') {
          setMsg(`Stripe price id for ${planKey} not configured.`)
        } else {
          setMsg(data.error || 'Checkout failed')
        }
        return
      }
      if (data.url) window.location.href = data.url
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  const openPortal = async () => {
    setBusy('portal')
    setMsg(null)
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg(data.error || 'Failed'); return }
      if (data.url) window.location.href = data.url
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section style={sectionStyle}>
      <div style={labelStyle}>Plan &amp; billing</div>
      <p style={{ fontFamily: 'var(--font-system)', fontSize: 12, color: '#8ea8c5', margin: '8px 0 12px' }}>
        Start free, upgrade when you&apos;re ready. Cancel anytime.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
        {PLANS.map(plan => (
          <div key={plan.key} style={{ background: '#1a2f4e', borderRadius: 10, padding: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontFamily: 'var(--font-system)', fontSize: 13, fontWeight: 700, color: '#eef3fa' }}>{plan.name}</div>
            <div style={{ fontFamily: 'var(--font-system)', fontSize: 16, fontWeight: 700, color: '#f59e0b', margin: '4px 0 8px' }}>{plan.price}</div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontFamily: 'var(--font-system)', fontSize: 11, color: '#8ea8c5' }}>
              {plan.features.map(f => <li key={f} style={{ marginBottom: 2 }}>• {f}</li>)}
            </ul>
            {canManage && plan.key !== 'enterprise' && (
              <button
                onClick={() => startCheckout(plan.key)}
                disabled={!!busy}
                style={{ width: '100%', marginTop: 10, padding: '8px 0', borderRadius: 8, background: '#2563eb', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.5 : 1 }}
              >
                {busy === plan.key ? '…' : 'Choose'}
              </button>
            )}
          </div>
        ))}
      </div>
      {canManage && (
        <button
          onClick={openPortal}
          disabled={!!busy}
          style={{ marginTop: 12, padding: '8px 14px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#eef3fa', fontFamily: 'var(--font-system)', fontSize: 12, cursor: 'pointer', opacity: busy ? 0.5 : 1 }}
        >
          {busy === 'portal' ? 'Opening…' : 'Manage current subscription'}
        </button>
      )}
      {msg && (
        <div role="status" style={{ marginTop: 10, fontFamily: 'var(--font-system)', fontSize: 12, color: '#f59e0b' }}>
          {msg}
        </div>
      )}
    </section>
  )
}
