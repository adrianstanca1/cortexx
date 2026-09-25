'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useDashboardData } from '@/lib/useDashboardData'
import { useRealtimeActivity } from '@/lib/useRealtimeActivity'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { IcSearch, IcDoc, IcBell, IcReceipt, IcClock } from '@/components/ui/Icons'
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
const Exec = dynamic(() => import('./Exec'), { ssr: false })
const Broadsheet = dynamic(() => import('./Broadsheet'), { ssr: false })
const SiteNotice = dynamic(() => import('./SiteNotice'), { ssr: false })
const FirstRunBanner = dynamic(() => import('./FirstRunBanner'), { ssr: false })

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
  { id: 'v13', label: '13', sub: 'Executive',     Comp: Exec },
  { id: 'v14', label: '14', sub: 'Broadsheet',    Comp: Broadsheet },
  { id: 'v15', label: '15', sub: 'Site notice',   Comp: SiteNotice },
]

const accent = 'var(--accent)'

interface CompProps {
  accent?: string
  data?: DashboardData | null
}

export default function DashboardSwitcher() {
  const router = useRouter()
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
  const { connected } = useRealtimeActivity(data?.activities || [])
  const [inboxCount, setInboxCount] = useState(0)

  useEffect(() => {
    // 401 on /api/inbox means the session expired mid-page-life. Without
    // a redirect the inbox badge silently shows 0 forever and the rest
    // of the dashboard's data fetches also start failing — user thinks
    // their workspace is empty.
    const fetchInbox = () => {
      fetch('/api/inbox').then(r => {
        if (r.status === 401) {
          router.push('/login?callbackUrl=' + encodeURIComponent(window.location.pathname + window.location.search))
          return null
        }
        return r.ok ? r.json() : null
      }).then(d => { if (d) setInboxCount(d.total || 0) }).catch(() => {})
    }
    fetchInbox()
    const i = setInterval(() => {
      if (document.visibilityState === 'visible') fetchInbox()
    }, 60000)
    return () => clearInterval(i)
  }, [router])

  // Adjust state when the URL ?v= param changes — the React 19 idiom: track
  // the previous value in state, run the sync during render when it changes.
  const [prevVParam, setPrevVParam] = useState(vParam)
  if (vParam !== prevVParam) {
    setPrevVParam(vParam)
    if (vParam) {
      const found = variants.find(v => v.id === `v${vParam}`)
      if (found) setActive(found.id)
    }
  }
  const current = variants.find(v => v.id === active)!
  const Comp = current.Comp as React.ComponentType<CompProps>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="dashboard-commandbar">
        <div>
          <div className="section-kicker">Cortex command centre</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 3 }}>
            <span className="display-title" style={{ fontSize: 20, color: 'var(--t1)' }}>{current.sub}</span>
            <span
              role="status"
              aria-live="polite"
              title={connected ? 'Live updates connected' : 'Reconnecting…'}
              style={{
                width: 7, height: 7, borderRadius: '50%',
                background: connected ? 'var(--green)' : 'var(--t3)',
                boxShadow: connected ? '0 0 12px rgba(69,209,138,.55)' : 'none',
              }}
            />
          </div>
        </div>

        <div className="dashboard-commandbar-actions">
          <Link href="/search" aria-label="Search workspace" className="command-icon-btn"><IcSearch size={16} /></Link>
          <Link href="/activity" aria-label="Activity feed" className="command-icon-btn"><IcClock size={16} /></Link>
          <Link href="/reports" aria-label="Reports" className="command-icon-btn"><IcReceipt size={16} /></Link>
          <Link href="/documents" aria-label="Documents" className="command-icon-btn"><IcDoc size={16} /></Link>
          <Link href="/inbox" aria-label={inboxCount > 0 ? `Inbox (${inboxCount})` : 'Inbox'} className="command-icon-btn" style={{ position: 'relative' }}>
            <IcBell size={16} color={inboxCount > 0 ? 'var(--accent)' : 'currentColor'} />
            {inboxCount > 0 && <span style={{
              position: 'absolute', top: -5, right: -5, minWidth: 17, height: 17,
              padding: '0 4px', borderRadius: 10, display: 'grid', placeItems: 'center',
              background: 'var(--red)', color: '#fff', fontSize: 8.5, fontWeight: 900,
              border: '2px solid var(--bg0)',
            }}>{inboxCount > 99 ? '99+' : inboxCount}</span>}
          </Link>
          <select
            className="dashboard-layout-select"
            aria-label="Dashboard layout"
            value={active}
            onChange={e => setActive(e.target.value)}
          >
            {variants.map(v => <option key={v.id} value={v.id}>{v.label} · {v.sub}</option>)}
          </select>
        </div>
      </div>

      {/* Dashboard content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontFamily: 'var(--font-system)', fontSize: 14 }}>Loading…</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--red)', fontFamily: 'var(--font-system)', fontSize: 14 }}>{error}</div>
        ) : (
          <ErrorBoundary key={active}>
            <FirstRunBanner data={data} />
            <Comp accent={accent} data={data} />
          </ErrorBoundary>
        )}
      </div>
    </div>
  )
}
