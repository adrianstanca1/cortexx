'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { IcChevL } from '@/components/ui/Icons'

interface AuditEvent {
  id: string
  action: string
  resourceType: string
  resourceId: string
  metadata: unknown
  ipAddress: string | null
  createdAt: string
  actor: { id: string; name: string | null; email: string } | null
}

export default function AuditLogPage() {
  const { data: session } = useSession()
  type SessionOrg = { id: string; slug: string; name: string; role: string }
  const orgs = ((session?.user as { organizations?: SessionOrg[] })?.organizations) || []
  const activeOrg = orgs[0]

  const [events, setEvents] = useState<AuditEvent[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const PAGE_SIZE = 100

  useEffect(() => {
    if (!activeOrg) return
    setLoading(true)
    const params = new URLSearchParams()
    if (filter) params.set('action', filter)
    params.set('take', String(PAGE_SIZE))
    fetch(`/api/orgs/${activeOrg.id}/audit-log?${params.toString()}`)
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error || 'Failed') }))
      .then(data => {
        setEvents(data.events || [])
        setTotal(data.total || 0)
        setHasMore(data.hasMore || false)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false))
  }, [activeOrg, filter])

  const loadMore = async () => {
    if (!activeOrg || loadingMore) return
    setLoadingMore(true)
    const params = new URLSearchParams()
    if (filter) params.set('action', filter)
    params.set('take', String(PAGE_SIZE))
    params.set('skip', String(events.length))
    try {
      const r = await fetch(`/api/orgs/${activeOrg.id}/audit-log?${params.toString()}`)
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Failed')
      setEvents(prev => [...prev, ...(data.events || [])])
      setHasMore(data.hasMore || false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoadingMore(false)
    }
  }

  if (!activeOrg) {
    return <div style={{ background: '#06101e', minHeight: '100dvh', padding: 24, color: '#8ea8c5', fontFamily: 'var(--font-system)' }}>No active workspace.</div>
  }

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', padding: '20px 20px 100px 60px' }}>
      <Link href="/settings/organization" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 12 }}>
        <IcChevL size={18} color="#52749a" />
        <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>Workspace</span>
      </Link>

      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)', marginBottom: 4 }}>
        Audit log
      </h1>
      <p style={{ fontSize: 13, color: '#8ea8c5', fontFamily: 'var(--font-system)', marginBottom: 16 }}>
        Immutable forensic log of every workspace change. {total.toLocaleString('en-GB')} event{total === 1 ? '' : 's'} tracked.
      </p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {['', 'project', 'invoice', 'task', 'member', 'invite', 'billing'].map(f => (
          <button
            key={f || 'all'}
            onClick={() => setFilter(f)}
            style={{ padding: '5px 10px', borderRadius: 999, background: filter === f ? '#f59e0b' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: filter === f ? '#06101e' : '#8ea8c5', fontFamily: 'var(--font-system)', fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}
          >
            {f || 'all'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#52749a', fontSize: 13, fontFamily: 'var(--font-system)' }}>Loading…</div>
      ) : error ? (
        <div style={{ color: '#ef4444', fontSize: 13, fontFamily: 'var(--font-system)' }}>{error}</div>
      ) : events.length === 0 ? (
        <div style={{ color: '#52749a', fontSize: 13, fontFamily: 'var(--font-system)' }}>No events yet.</div>
      ) : (
        <div style={{ background: '#152641', borderRadius: 14, padding: 4, border: '0.5px solid rgba(255,255,255,0.07)' }}>
          {events.map(e => (
            <div key={e.id} style={{ padding: '10px 12px', borderBottom: '0.5px solid rgba(255,255,255,0.05)', display: 'grid', gridTemplateColumns: '110px 1fr auto', gap: 12, alignItems: 'center' }}>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#52749a', whiteSpace: 'nowrap' }}>
                {new Date(e.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-system)', fontSize: 12, color: '#eef3fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>{e.action}</span>
                  <span style={{ color: '#52749a' }}> · {e.resourceType}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#8ea8c5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.actor ? (e.actor.name || e.actor.email) : 'system'}
                  {e.ipAddress && <span style={{ color: '#52749a' }}> · {e.ipAddress}</span>}
                </div>
              </div>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: '#52749a', textAlign: 'right' }}>
                {e.resourceId.slice(0, 8)}
              </div>
            </div>
          ))}
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', borderTop: '0.5px solid rgba(255,255,255,0.05)', fontFamily: 'var(--font-system)', fontSize: 11, color: loadingMore ? '#52749a' : '#f59e0b', textAlign: 'center', cursor: loadingMore ? 'default' : 'pointer', fontWeight: 600 }}
            >
              {loadingMore ? 'Loading…' : `Load more (${events.length} of ${total.toLocaleString('en-GB')})`}
            </button>
          )}
          {!hasMore && events.length > 0 && (
            <div style={{ padding: '10px 12px', fontFamily: 'var(--font-system)', fontSize: 10, color: '#52749a', textAlign: 'center' }}>
              End of log · {events.length.toLocaleString('en-GB')} event{events.length === 1 ? '' : 's'} shown
            </div>
          )}
        </div>
      )}
    </div>
  )
}
