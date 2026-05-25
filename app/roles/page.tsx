'use client'

/**
 * Roles — workspace-level RBAC overview. Lists each member of the
 * active organisation with their role + last activity. Role mutation
 * itself happens via /settings/organization (the org-owner-only page).
 * This is a read-mostly view that surfaces role changes across the
 * whole team in one screen.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Avatar from '@/components/ui/Avatar'
import { IcChevL, IcTeam } from '@/components/ui/Icons'

type Role = 'owner' | 'admin' | 'member' | 'viewer'

interface MemberRow {
  userId: string
  email: string
  name: string | null
  role: Role
  joinedAt: string
  lastSeenAt: string | null
}

const ROLE_COLOR: Record<Role, string> = {
  owner: '#f59e0b',
  admin: '#06b6d4',
  member: '#10b981',
  viewer: '#52749a',
}

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
}

export default function RolesPage() {
  const [rows, setRows] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/orgs/members')
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error || 'Failed') }))
      .then(d => setRows(d.members || []))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false))
  }, [])

  const grouped: Record<Role, MemberRow[]> = { owner: [], admin: [], member: [], viewer: [] }
  for (const r of rows) {
    if (grouped[r.role]) grouped[r.role].push(r)
  }

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 12 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>All apps</span>
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)', margin: 0 }}>
          Roles
        </h1>
        <p style={{ fontSize: 13, color: '#8ea8c5', fontFamily: 'var(--font-system)', margin: '4px 0 0' }}>
          Who can do what in this workspace. <Link href="/settings/organization" style={{ color: '#f59e0b', textDecoration: 'none' }}>Change roles →</Link>
        </p>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {loading ? (
          <p style={{ color: '#52749a', padding: 40, textAlign: 'center', fontFamily: 'var(--font-system)', fontSize: 13 }}>Loading…</p>
        ) : error ? (
          <p style={{ color: '#ef4444', padding: 40, textAlign: 'center', fontFamily: 'var(--font-system)', fontSize: 13 }}>{error}</p>
        ) : (
          (['owner', 'admin', 'member', 'viewer'] as const).map(role => {
            const members = grouped[role]
            if (members.length === 0) return null
            return (
              <section key={role} style={{ marginBottom: 20 }}>
                <p style={{ fontFamily: 'var(--font-system)', fontSize: 11, fontWeight: 700, color: ROLE_COLOR[role], letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  {ROLE_LABEL[role]} <span style={{ color: '#8ea8c5' }}>· {members.length}</span>
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {members.map(m => (
                    <li key={m.userId} style={{ background: '#152641', borderRadius: 10, padding: '10px 12px', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-system)' }}>
                      <Avatar name={m.name || m.email} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: '#eef3fa', fontWeight: 600 }}>{m.name || m.email}</div>
                        <div style={{ fontSize: 11, color: '#8ea8c5', marginTop: 2 }}>
                          {m.email}{m.lastSeenAt ? ` · last seen ${new Date(m.lastSeenAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}` : ' · never signed in'}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })
        )}
        {!loading && !error && rows.length === 0 && (
          <div style={{ color: '#52749a', fontSize: 13, padding: 60, textAlign: 'center', fontFamily: 'var(--font-system)' }}>
            <IcTeam size={32} color="#52749a" />
            <p style={{ marginTop: 12 }}>You&rsquo;re the only member. <Link href="/team" style={{ color: '#f59e0b', textDecoration: 'none' }}>Invite teammates →</Link></p>
          </div>
        )}
      </div>

      <TabBar />
    </div>
  )
}
