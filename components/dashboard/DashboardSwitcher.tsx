'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useDashboardData } from '@/lib/useDashboardData'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { IcSearch, IcDoc, IcBell, IcReceipt } from '@/components/ui/Icons'
import type { DashboardData } from '@/lib/types'

const ActionFirst = dynamic(() => import('./ActionFirst'), { ssr: false })
const StatusBoard = dynamic(() => import('./StatusBoard'), { ssr: false })
const Calm = dynamic(() => import('./Calm'), { ssr: false })
const Bento = dynamic(() => import('./Bento'), { ssr: false })
const AIForward = dynamic(() => import('./AIForward'), { ssr: false })
const Field = dynamic(() => import('./Field'), { ssr: false })
const Timeline = dynamic(() => import('./Timeline'), { ssr: false })
const Money = dynamic(() => import('./Money'), { ssr: false })
const Stories = dynamic(() => import('./Stories'), { ssr: false })
const Rings = dynamic(() => import('./Rings'), { ssr: false })
const SiteMap = dynamic(() => import('./SiteMap'), { ssr: false })
const Focus = dynamic(() => import('./Focus'), { ssr: false })

const variants = [
  { id: 'v1',  label: '01', sub: 'Action-first',  Comp: ActionFirst },
  { id: 'v2',  label: '02', sub: 'Status board',  Comp: StatusBoard },
  { id: 'v3',  label: '03', sub: 'Calm',          Comp: Calm },
  { id: 'v4',  label: '04', sub: 'Bento',         Comp: Bento },
  { id: 'v5',  label: '05', sub: 'AI-forward',    Comp: AIForward },
  { id: 'v6',  label: '06', sub: 'Field',         Comp: Field },
  { id: 'v7',  label: '07', sub: 'Timeline',      Comp: Timeline },
  { id: 'v8',  label: '08', sub: 'Books',         Comp: Money },
  { id: 'v9',  label: '09', sub: 'Stories',       Comp: Stories },
  { id: 'v10', label: '10', sub: 'Rings',         Comp: Rings },
  { id: 'v11', label: '11', sub: 'Map',           Comp: SiteMap },
  { id: 'v12', label: '12', sub: 'Focus',         Comp: Focus },
]

const accent = '#f59e0b'

const iconBtnStyle: React.CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 34,
  height: 34,
  borderRadius: 10,
  background: 'rgba(255,255,255,0.06)',
  border: '0.5px solid rgba(255,255,255,0.07)',
  marginRight: 2,
}

interface CompProps {
  accent?: string
  data?: DashboardData | null
}

export default function DashboardSwitcher() {
  const searchParams = useSearchParams()
  const vParam = searchParams.get('v')
  const [active, setActive] = useState(() => {
    if (vParam) {
      const found = variants.find(v => v.id === `v${vParam}` || v.label === vParam)
      if (found) return found.id
    }
    return 'v1'
  })
  const { data, loading, error } = useDashboardData()
  const [inboxCount, setInboxCount] = useState(0)

  useEffect(() => {
    fetch('/api/inbox').then(r => r.ok ? r.json() : null).then(d => { if (d) setInboxCount(d.total || 0) }).catch(() => {})
    const i = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetch('/api/inbox').then(r => r.ok ? r.json() : null).then(d => { if (d) setInboxCount(d.total || 0) }).catch(() => {})
      }
    }, 60000)
    return () => clearInterval(i)
  }, [])

  useEffect(() => {
    if (vParam) {
      const found = variants.find(v => v.id === `v${vParam}`)
      if (found) setActive(found.id)
    }
  }, [vParam])
  const current = variants.find(v => v.id === active)!
  const Comp = current.Comp as React.ComponentType<CompProps>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Variant switcher strip */}
      <div style={{
        overflowX: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '12px 56px 8px 16px',
        background: 'rgba(6,16,30,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '0.5px solid rgba(255,255,255,0.07)',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        flexShrink: 0,
      }}>
        <Link
          href="/search"
          aria-label="Search workspace"
          style={iconBtnStyle}
        >
          <IcSearch size={16} color="#8ea8c5" />
        </Link>
        <Link
          href="/reports"
          aria-label="Reports"
          style={iconBtnStyle}
        >
          <IcReceipt size={16} color="#8ea8c5" />
        </Link>
        <Link
          href="/documents"
          aria-label="Documents"
          style={iconBtnStyle}
        >
          <IcDoc size={16} color="#8ea8c5" />
        </Link>
        <Link
          href="/inbox"
          aria-label={inboxCount > 0 ? `Inbox (${inboxCount})` : 'Inbox'}
          style={{ ...iconBtnStyle, marginRight: 4, position: 'relative' }}
        >
          <IcBell size={16} color={inboxCount > 0 ? '#f59e0b' : '#8ea8c5'} />
          {inboxCount > 0 && (
            <span style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 700, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-system)', border: '2px solid #06101e', boxSizing: 'content-box' }}>
              {inboxCount > 99 ? '99+' : inboxCount}
            </span>
          )}
        </Link>
        {variants.map(v => {
          const isActive = v.id === active
          return (
            <button
              key={v.id}
              onClick={() => setActive(v.id)}
              aria-label={`Switch to ${v.sub} dashboard variant`}
              aria-pressed={isActive}
              style={{
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                padding: '6px 10px',
                borderRadius: 10,
                background: isActive ? accent : 'rgba(255,255,255,0.06)',
                border: isActive ? 'none' : '0.5px solid rgba(255,255,255,0.07)',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 700, color: isActive ? '#fff' : '#52749a', letterSpacing: 0.5 }}>{v.label}</span>
              <span style={{ fontFamily: 'var(--font-system)', fontSize: 10, color: isActive ? '#fff' : '#8ea8c5', whiteSpace: 'nowrap' }}>{v.sub}</span>
            </button>
          )
        })}
      </div>

      {/* Dashboard content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: 'var(--font-system)', fontSize: 14 }}>Loading…</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: 'var(--font-system)', fontSize: 14 }}>{error}</div>
        ) : (
          <ErrorBoundary key={active}>
            <Comp accent={accent} data={data} />
          </ErrorBoundary>
        )}
      </div>
    </div>
  )
}
