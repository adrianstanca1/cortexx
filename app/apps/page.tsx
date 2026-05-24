'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  IcCamera, IcMic, IcReceipt, IcAlert, IcCheck, IcPin, IcSpark, IcDoc,
  IcBell, IcSearch, IcDashboard, IcProjects, IcTasks, IcTeam,
  IcClock, IcLayers, IcWrench, IcTruck, IcHardhat, IcArrowRight,
} from '@/components/ui/Icons'

interface ModuleItem {
  href: string
  label: string
  Icon: React.ComponentType<{ size?: number; color?: string }>
  color: string
  ai?: boolean
  comingSoon?: boolean
  badgeKey?: 'inbox' | 'rfis' | 'snags' | 'observations' | 'variations' | 'pos' | 'subinvoices' | 'materials' | 'timesheets' | 'training' | 'leads' | 'messages'
}

interface CaptureAction {
  id: string
  label: string
  sub: string
  Icon: React.ComponentType<{ size?: number; color?: string }>
  color: string
  ai?: boolean
  href?: string
}

const CAPTURE: CaptureAction[] = [
  { id: 'smart-parse', label: 'Smart parse', sub: 'Paste anything → structured records', Icon: IcSpark, color: '#8b5cf6', ai: true },
  { id: 'new-task',    label: 'New task',    sub: 'Quick add to your queue',          Icon: IcCheck, color: '#2563eb', href: '/tasks?new=1' },
  { id: 'ai-estimate', label: 'AI estimate', sub: 'Brief in → quote out',             Icon: IcDoc,   color: '#60a5fa', ai: true },
  { id: 'site-photo',  label: 'Site progress photo', sub: 'Geo-tagged · added to project', Icon: IcCamera, color: '#2563eb', href: '/capture?type=photo' },
  { id: 'snag-photo',  label: 'Snag from photo',    sub: 'AI detects defects · auto-files', Icon: IcAlert, color: '#f59e0b', ai: true },
  { id: 'scan-receipt',label: 'Scan receipt', sub: 'AI OCR + auto-file',              Icon: IcReceipt, color: '#f59e0b', ai: true, href: '/capture?type=receipt' },
  { id: 'voice-rfi',   label: 'Voice note / RFI', sub: 'Transcribed by Cortex',       Icon: IcMic,   color: '#06b6d4', href: '/capture?type=voice' },
  { id: 'site-checkin',label: 'Site check-in', sub: 'GPS verified · logs hours',     Icon: IcPin,   color: '#10b981', href: '/capture?type=checkin' },
  { id: 'incident',    label: 'Report incident', sub: 'Notify HSE if required',      Icon: IcAlert, color: '#ef4444', href: '/capture?type=incident' },
]

const SECTIONS: { title: string; items: ModuleItem[] }[] = [
  {
    title: 'Inbox & comms',
    items: [
      { href: '/inbox',    label: 'Inbox',      Icon: IcBell,   color: '#2563eb', badgeKey: 'inbox' },
      { href: '/messages', label: 'Messages',   Icon: IcBell,   color: '#06b6d4', badgeKey: 'messages' },
      { href: '/rfis',     label: 'RFIs',       Icon: IcAlert,  color: '#f59e0b', badgeKey: 'rfis' },
      { href: '/ask',      label: 'Ask Cortex', Icon: IcSpark,  color: '#8b5cf6', ai: true, comingSoon: true },
    ],
  },
  {
    title: 'Sales & CRM',
    items: [
      { href: '/leads',     label: 'Leads',       Icon: IcArrowRight, color: '#06b6d4', badgeKey: 'leads', comingSoon: true },
      { href: '/customers', label: 'Customers',   Icon: IcTeam,       color: '#2563eb', comingSoon: true },
      { href: '/quotes',    label: 'Quotes',      Icon: IcDoc,        color: '#06b6d4', comingSoon: true },
      { href: '/client-view', label: 'Client view', Icon: IcLayers,   color: '#10b981', comingSoon: true },
    ],
  },
  {
    title: 'Project & site',
    items: [
      { href: '/projects',           label: 'Timeline',   Icon: IcLayers,   color: '#2563eb' },
      { href: '/schedule',           label: 'Schedule',   Icon: IcClock,    color: '#06b6d4', comingSoon: true },
      { href: '/site-diary',         label: 'Site diary', Icon: IcDoc,      color: '#10b981' },
      { href: '/photos',             label: 'Photos',     Icon: IcCamera,   color: '#8b5cf6' },
      { href: '/drawings',           label: 'Drawings',   Icon: IcLayers,   color: '#2563eb', comingSoon: true },
      { href: '/documents',          label: 'Documents',  Icon: IcDoc,      color: '#ef4444' },
      { href: '/snags',              label: 'Snags',      Icon: IcAlert,    color: '#ef4444', badgeKey: 'snags' },
      { href: '/observations',       label: 'Observations', Icon: IcCheck,  color: '#22c55e', badgeKey: 'observations' },
      { href: '/variations',         label: 'Variations', Icon: IcWrench,   color: '#8b5cf6', badgeKey: 'variations' },
    ],
  },
  {
    title: 'Money & ops',
    items: [
      { href: '/reports',     label: 'Money',        Icon: IcReceipt, color: '#10b981' },
      { href: '/pos',         label: 'POs',          Icon: IcDoc,     color: '#f59e0b', badgeKey: 'pos', comingSoon: true },
      { href: '/sub-invoices',label: 'Sub invoices', Icon: IcDoc,     color: '#f59e0b', badgeKey: 'subinvoices', comingSoon: true },
      { href: '/materials',   label: 'Materials',    Icon: IcWrench,  color: '#f59e0b', badgeKey: 'materials', comingSoon: true },
      { href: '/subs',        label: 'Subs',         Icon: IcTeam,    color: '#2563eb', comingSoon: true },
      { href: '/equipment',   label: 'Equipment',    Icon: IcWrench,  color: '#52749a', comingSoon: true },
      { href: '/cost-catalog',label: 'Cost catalog', Icon: IcLayers,  color: '#06b6d4', comingSoon: true },
      { href: '/mileage',     label: 'Mileage',      Icon: IcTruck,   color: '#06b6d4', comingSoon: true },
    ],
  },
  {
    title: 'People & time',
    items: [
      { href: '/timesheets',    label: 'Timesheets',    Icon: IcClock,   color: '#8b5cf6', badgeKey: 'timesheets' },
      { href: '/check-in',      label: 'Check in/out',  Icon: IcPin,     color: '#10b981', comingSoon: true },
      { href: '/live-status',   label: 'Live status',   Icon: IcPin,     color: '#06b6d4', comingSoon: true },
      { href: '/training',      label: 'Training',      Icon: IcHardhat, color: '#f59e0b', badgeKey: 'training' },
    ],
  },
]

interface BadgeData {
  inbox?: number
  rfis?: number
  snags?: number
  observations?: number
  variations?: number
  pos?: number
  subinvoices?: number
  materials?: number
  timesheets?: number
  training?: number
  leads?: number
  messages?: number
}

export default function AppsPage() {
  const router = useRouter()
  const [badges, setBadges] = useState<BadgeData>({})

  useEffect(() => {
    // Pull real counts; tolerant of missing endpoints
    Promise.all([
      fetch('/api/inbox').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/timeentries?approved=false&allWeeks=true').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/snags?status=open&take=1').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/rfis?take=1').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/training').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/observations?take=1').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/variations?take=1').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([inbox, timesheets, snags, rfis, training, observations, variations]) => {
      setBadges({
        inbox: inbox?.total ?? 0,
        rfis: rfis?.openCount ?? 0,
        snags: snags?.openCount ?? 0,
        observations: observations?.unsafeOpenCount ?? 0,
        variations: variations?.pendingCount ?? 0,
        timesheets: Array.isArray(timesheets?.entries) ? timesheets.entries.length : 0,
        training: (training?.counts?.expired ?? 0) + (training?.counts?.expiring ?? 0),
      })
    })
  }, [])

  const handleCapture = (item: CaptureAction) => {
    if (item.href) router.push(item.href)
    // else: AI features are stubs for now
  }

  return (
    <div style={{ padding: '20px 0 100px', background: '#06101e', minHeight: '100dvh' }}>
      {/* Header */}
      <div style={{ padding: '4px 20px 18px' }}>
        <h1 style={{ fontFamily: 'var(--font-system)', fontSize: 26, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em' }}>Apps</h1>
        <p style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#8ea8c5', marginTop: 2 }}>
          Quick capture + every module
        </p>
      </div>

      {/* CAPTURE list */}
      <div style={{ padding: '0 16px 8px' }}>
        <div style={{ fontFamily: 'var(--font-system)', fontSize: 11, fontWeight: 700, color: '#8ea8c5', letterSpacing: '0.12em', padding: '6px 6px 8px' }}>
          CAPTURE
        </div>
        <div style={{ background: '#0c1a2e', borderRadius: 14, border: '0.5px solid rgba(255,255,255,0.07)' }}>
          {CAPTURE.map((c, i) => (
            <div
              key={c.id}
              onClick={() => handleCapture(c)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px',
                borderBottom: i === CAPTURE.length - 1 ? 'none' : '0.5px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: `${c.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <c.Icon size={20} color={c.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-system)', fontSize: 15, fontWeight: 600, color: '#eef3fa' }}>{c.label}</div>
                <div style={{ fontFamily: 'var(--font-system)', fontSize: 12, color: '#8ea8c5', marginTop: 1 }}>{c.sub}</div>
              </div>
              {c.ai ? (
                <span style={{ fontFamily: 'var(--font-system)', fontSize: 10, fontWeight: 700, color: '#8b5cf6' }}>AI</span>
              ) : (
                <IcArrowRight size={16} color="#52749a" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ALL APPS by section */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontFamily: 'var(--font-system)', fontSize: 11, fontWeight: 700, color: '#8ea8c5', letterSpacing: '0.12em', padding: '6px 6px 8px' }}>
          ALL APPS
        </div>
        {SECTIONS.map(section => (
          <div key={section.title} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: 'var(--font-system)', fontSize: 13, fontWeight: 600, color: '#8ea8c5', padding: '4px 6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#52749a' }}>◆</span> {section.title}
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
            }}>
              {section.items.map(m => {
                const badge = m.badgeKey ? badges[m.badgeKey] : undefined
                const soon = m.comingSoon === true
                const showBadge = badge !== undefined && badge > 0 && !soon
                return (
                  <Link
                    key={m.href}
                    href={m.href}
                    aria-label={soon ? `${m.label} (coming soon)` : m.label}
                    style={{
                      position: 'relative',
                      background: '#0c1a2e', borderRadius: 12,
                      padding: '14px 8px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                      textDecoration: 'none', color: '#eef3fa',
                      border: '0.5px solid rgba(255,255,255,0.05)',
                      minHeight: 76,
                      opacity: soon ? 0.55 : 1,
                    }}
                  >
                    {showBadge && (
                      <span style={{
                        position: 'absolute', top: 6, right: 6,
                        background: '#ef4444', color: '#fff',
                        fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-system)',
                        padding: '1px 5px', borderRadius: 99, minWidth: 16, textAlign: 'center',
                      }}>{badge}</span>
                    )}
                    {m.ai && !soon && (
                      <span style={{
                        position: 'absolute', top: 6, right: 6,
                        fontSize: 9, fontWeight: 700, color: '#8b5cf6', fontFamily: 'var(--font-system)',
                      }}>AI</span>
                    )}
                    {soon && (
                      <span style={{
                        position: 'absolute', top: 6, right: 6,
                        fontSize: 8, fontWeight: 700, color: '#f59e0b',
                        fontFamily: 'var(--font-system)', letterSpacing: '0.06em',
                        background: 'rgba(245,158,11,0.12)', padding: '1px 5px', borderRadius: 4,
                      }}>SOON</span>
                    )}
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: `${m.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <m.Icon size={18} color={m.color} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-system)', fontSize: 11, fontWeight: 600, color: '#eef3fa', textAlign: 'center' }}>{m.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer indicator */}
      <div style={{ textAlign: 'center', padding: '8px 20px 16px', fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a' }}>
        5 tabs · 12 dashboards · live Cortex AI
      </div>
    </div>
  )
}
