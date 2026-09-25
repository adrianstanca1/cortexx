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
import { ASSIGNABLE_PERSONAS, personaLabel } from '@/lib/persona'

interface MemberRow {
  userId: string
  email: string
  name: string | null
  role: string
  personaRole: string
  joinedAt: string
  lastSeenAt: string | null
}

const ROLE_COLOR: Record<string, string> = {
  company_admin: '#06b6d4',
  project_manager: '#8b5cf6',
  foreman: '#3b82f6',
  operative: '#10b981',
  client: '#ec4899',
}

const PERSONA_ORDER = [...ASSIGNABLE_PERSONAS]


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

  const grouped = Object.fromEntries(PERSONA_ORDER.map(role => [role, [] as MemberRow[]])) as Record<string, MemberRow[]>
  for (const row of rows) {
    const persona = PERSONA_ORDER.includes(row.personaRole as (typeof ASSIGNABLE_PERSONAS)[number]) ? row.personaRole : 'operative'
    grouped[persona].push(row)
  }

  return (
    <div className="module-page" style={{ background: 'var(--bg0)', minHeight: '100dvh', paddingBottom: 100 }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 12 }}>
          <IcChevL size={18} color="var(--t3)" />
          <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: 'var(--t3)' }}>All apps</span>
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)', margin: 0 }}>
          Roles
        </h1>
        <p style={{ fontSize: 13, color: 'var(--t2)', fontFamily: 'var(--font-system)', margin: '4px 0 0' }}>
          Who can do what in this workspace. <Link href="/settings/organization" style={{ color: '#f59e0b', textDecoration: 'none' }}>Change roles →</Link>
        </p>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {loading ? (
          <p style={{ color: 'var(--t3)', padding: 40, textAlign: 'center', fontFamily: 'var(--font-system)', fontSize: 13 }}>Loading…</p>
        ) : error ? (
          <p style={{ color: '#ef4444', padding: 40, textAlign: 'center', fontFamily: 'var(--font-system)', fontSize: 13 }}>{error}</p>
        ) : (
          PERSONA_ORDER.map(role => {
            const members = grouped[role]
            if (members.length === 0) return null
            return (
              <section key={role} style={{ marginBottom: 20 }}>
                <p style={{ fontFamily: 'var(--font-system)', fontSize: 11, fontWeight: 700, color: ROLE_COLOR[role] || 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  {personaLabel(role)} <span style={{ color: 'var(--t2)' }}>· {members.length}</span>
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {members.map(m => (
                    <li key={m.userId} style={{ background: 'var(--surface-raised)', borderRadius: 10, padding: '10px 12px', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-system)' }}>
                      <Avatar name={m.name || m.email} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--t1)', fontWeight: 600 }}>{m.name || m.email}</div>
                        <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>
                          {m.email} · {m.role} access{m.lastSeenAt ? ` · last seen ${new Date(m.lastSeenAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}` : ' · never signed in'}
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
          <div style={{ color: 'var(--t3)', fontSize: 13, padding: 60, textAlign: 'center', fontFamily: 'var(--font-system)' }}>
            <IcTeam size={32} color="var(--t3)" />
            <p style={{ marginTop: 12 }}>You&rsquo;re the only member. <Link href="/team" style={{ color: '#f59e0b', textDecoration: 'none' }}>Invite teammates →</Link></p>
          </div>
        )}
      </div>

      <TabBar />
    </div>
  )
}
