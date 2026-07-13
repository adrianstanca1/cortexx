'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Avatar from '@/components/ui/Avatar'
import Skeleton from '@/components/ui/Skeleton'
import { IcChevL, IcSearch, IcX } from '@/components/ui/Icons'
import ActivityIcon from '@/components/ui/ActivityIcon'
import RelativeTime from '@/components/ui/RelativeTime'
import PresencePill from '@/components/ui/PresencePill'
import { useRealtimeActivity } from '@/lib/useRealtimeActivity'

interface Activity {
  id: string
  projectId: string | null
  actorName: string
  actorType: string
  action: string
  detail: string | null
  iconType: string
  createdAt: string
  project?: { id: string; name: string } | null
}

const PAGE_SIZE = 25
const ACTOR_COLOR: Record<string, string> = { human: '#2563eb', ai: '#8b5cf6', system: '#52749a' }

export default function ActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [skip, setSkip] = useState(0)
  const [actorFilter, setActorFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [projectFilter, setProjectFilter] = useState<string>('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestIdRef = useRef(0)

  // Live SSE stream prepends new activities as they happen. The hook
  // reseeds whenever the `activities` reference changes (e.g. after
  // a filter-triggered refetch), so applied filters keep working.
  // Cast — the global Activity type has a thicker `project` shape;
  // we only use id/name here.
  const realtime = useRealtimeActivity(activities as unknown as Parameters<typeof useRealtimeActivity>[0])
  const liveActivities = realtime.activities as unknown as Activity[]
  const connected = realtime.connected

  const buildParams = useCallback((pageSkip: number) => {
    const params = new URLSearchParams()
    params.set('take', String(PAGE_SIZE))
    params.set('skip', String(pageSkip))
    if (actorFilter !== 'all') params.set('actorType', actorFilter)
    if (projectFilter) params.set('projectId', projectFilter)
    if (search.trim().length >= 2) params.set('q', search.trim())
    return params
  }, [actorFilter, projectFilter, search])

  const load = useCallback((reset = false) => {
    const nextSkip = reset ? 0 : skip
    if (reset) {
      setLoading(true)
      requestIdRef.current++
    }
    const thisRequest = requestIdRef.current
    const params = buildParams(nextSkip)
    fetch(`/api/activity?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        // Ignore stale responses (user changed filters while fetch was in flight).
        if (thisRequest !== requestIdRef.current) return
        const incoming = d.activities || []
        setActivities(prev => {
          if (reset) return incoming
          const seen = new Set(prev.map(a => a.id))
          return [...prev, ...incoming.filter((a: Activity) => !seen.has(a.id))]
        })
        setHasMore(d.hasMore ?? false)
        if (reset) setSkip(PAGE_SIZE)
        else setSkip(s => s + PAGE_SIZE)
        setLoading(false)
        setLoadingMore(false)
      })
      .catch(() => {
        if (thisRequest !== requestIdRef.current) return
        setLoading(false)
        setLoadingMore(false)
      })
  }, [skip, buildParams])
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  }, [load])

  // Reset pagination whenever filters/search change.
  useEffect(() => {
    setSkip(0)
    requestIdRef.current++
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadRef.current(true), 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [actorFilter, projectFilter, search])

  useEffect(() => {
    fetch('/api/projects?take=100').then(r => r.json()).then(d => setProjects((d.projects || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))).catch(() => {})
  }, [])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    loadRef.current(false)
  }, [loadingMore, hasMore])

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      <div style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>Back</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: 'var(--font-system)', margin: 0 }}>Activity</h1>
          <span
            role="status"
            aria-label={connected ? 'Live updates connected' : 'Reconnecting'}
            title={connected ? 'Live updates connected' : 'Reconnecting…'}
            style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#10b981' : '#52749a', boxShadow: connected ? '0 0 6px #10b98166' : 'none', transition: 'all 0.3s' }}
          />
          <PresencePill screen="activity" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#152641', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '9px 14px', marginTop: 10 }}>
          <IcSearch size={14} color="#52749a" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search activity…"
            style={{ background: 'none', border: 'none', outline: 'none', color: '#eef3fa', fontFamily: 'var(--font-system)', fontSize: 13, flex: 1 }}
          />
          {search && <button onClick={() => setSearch('')} aria-label="Clear search" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><IcX size={14} color="#52749a" /></button>}
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, marginTop: 10 }}>
          {(['all', 'human', 'ai'] as const).map(t => (
            <button key={t} onClick={() => setActorFilter(t)} style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 99, border: 'none', background: actorFilter === t ? (t === 'ai' ? '#8b5cf6' : t === 'human' ? '#2563eb' : '#f59e0b') : 'rgba(255,255,255,0.06)', color: actorFilter === t ? '#fff' : '#52749a', fontFamily: 'var(--font-system)', fontSize: 12, fontWeight: actorFilter === t ? 700 : 400, cursor: 'pointer', textTransform: 'capitalize' }}>
              {t}
            </button>
          ))}
          <select
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
            style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 99, border: '0.5px solid rgba(255,255,255,0.07)', background: projectFilter ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.06)', color: projectFilter ? '#f59e0b' : '#52749a', fontFamily: 'var(--font-system)', fontSize: 12, cursor: 'pointer', appearance: 'none' }}
          >
            <option value="">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ padding: '12px 20px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ background: '#152641', borderRadius: 12, padding: '10px 12px', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Skeleton width={28} height={28} borderRadius="50%" />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Skeleton width="60%" height={13} />
                  <Skeleton width="40%" height={11} />
                </div>
              </div>
            ))}
          </div>
        ) : liveActivities.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#52749a', fontFamily: 'var(--font-system)' }}>
            {search || actorFilter !== 'all' || projectFilter ? 'No activity matches your filters.' : 'No activity yet.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {liveActivities.map(a => {
              const color = ACTOR_COLOR[a.actorType] || '#52749a'
              return (
                <div key={a.id} style={{ background: '#152641', borderRadius: 12, padding: '10px 12px', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <Avatar name={a.actorName} color={color} size={28} />
                    <ActivityIcon iconType={a.iconType} size={14} color={color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#eef3fa', lineHeight: 1.3 }}>
                      <span style={{ fontWeight: 600 }}>{a.actorName}</span>{' '}
                      <span style={{ color: '#8ea8c5' }}>{a.action}</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.project?.name && <Link href={`/projects/${a.project.id}`} style={{ color: '#8ea8c5', textDecoration: 'none' }}>{a.project.name}</Link>}
                      {a.project && a.detail && ' · '}
                      {a.detail}
                      {' · '}<RelativeTime date={a.createdAt} />
                    </div>
                  </div>
                </div>
              )
            })}

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                style={{
                  marginTop: 8,
                  padding: '10px 16px',
                  borderRadius: 12,
                  border: '0.5px solid rgba(255,255,255,0.07)',
                  background: '#152641',
                  color: '#8ea8c5',
                  fontFamily: 'var(--font-system)',
                  fontSize: 13,
                  cursor: loadingMore ? 'wait' : 'pointer',
                  opacity: loadingMore ? 0.7 : 1,
                }}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        )}
      </div>

      <TabBar />
    </div>
  )
}
