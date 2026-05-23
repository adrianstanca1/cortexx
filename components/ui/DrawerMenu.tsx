'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { IcX, IcSearch, IcClock, IcReceipt, IcDoc, IcBell, IcDashboard, IcProjects, IcTasks, IcTeam, IcCamera, IcSpark, IcSettings } from './Icons'

interface MenuItem {
  href: string
  label: string
  Icon: React.ComponentType<{ size?: number; color?: string }>
  color?: string
}

const PRIMARY: MenuItem[] = [
  { href: '/dashboard', label: 'Dashboard', Icon: IcDashboard, color: '#f59e0b' },
  { href: '/projects', label: 'Projects', Icon: IcProjects, color: '#2563eb' },
  { href: '/tasks', label: 'Tasks', Icon: IcTasks, color: '#10b981' },
  { href: '/team', label: 'Team', Icon: IcTeam, color: '#8b5cf6' },
  { href: '/capture', label: 'Capture', Icon: IcCamera, color: '#06b6d4' },
]

const SECONDARY: MenuItem[] = [
  { href: '/inbox', label: 'Inbox', Icon: IcBell, color: '#ef4444' },
  { href: '/activity', label: 'Activity feed', Icon: IcClock, color: '#8ea8c5' },
  { href: '/search', label: 'Search', Icon: IcSearch, color: '#8ea8c5' },
  { href: '/reports', label: 'Reports', Icon: IcReceipt, color: '#10b981' },
  { href: '/documents', label: 'Documents', Icon: IcDoc, color: '#2563eb' },
]

export default function DrawerMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [inboxCount, setInboxCount] = useState(0)
  const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname?.startsWith(href + '/'))

  useEffect(() => {
    if (!open) return
    fetch('/api/inbox').then(r => r.ok ? r.json() : null).then(d => { if (d) setInboxCount(d.total || 0) }).catch(() => {})
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  const userInitial = (session?.user?.name || session?.user?.email || 'U').trim().charAt(0).toUpperCase()

  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 220, display: 'flex' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
      <aside
        style={{
          position: 'relative',
          background: '#0c1a2e',
          width: 'min(320px, 86vw)',
          height: '100dvh',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          padding: '20px 16px calc(20px + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          animation: 'drawerin 0.18s ease-out',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-system)', fontSize: 14, fontWeight: 700 }}>
              {userInitial}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-system)', fontSize: 13, fontWeight: 700, color: '#eef3fa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {session?.user?.name || session?.user?.email || 'User'}
              </div>
              {session?.user?.email && session?.user?.name && (
                <div style={{ fontFamily: 'var(--font-system)', fontSize: 10, color: '#52749a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {session.user.email}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 10, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <IcX size={16} color="#8ea8c5" />
          </button>
        </div>

        {/* Brand */}
        <div style={{ padding: '2px 4px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IcSpark size={14} color="#f59e0b" />
            <span style={{ fontFamily: 'var(--font-system)', fontSize: 18, fontWeight: 800, color: '#eef3fa', letterSpacing: '-0.03em' }}>
              Cortex<span style={{ color: '#f59e0b' }}>x</span>
            </span>
          </div>
          <div style={{ fontFamily: 'var(--font-system)', fontSize: 10, color: '#52749a', marginTop: 2 }}>Construction management</div>
        </div>

        {/* Primary nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <p style={menuLabel}>Main</p>
          {PRIMARY.map(item => <DrawerLink key={item.href} item={item} onClick={onClose} active={isActive(item.href)} />)}
        </nav>

        {/* Secondary nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <p style={menuLabel}>Workspace</p>
          {SECONDARY.map(item => (
            <DrawerLink
              key={item.href}
              item={item}
              onClick={onClose}
              active={isActive(item.href)}
              badge={item.href === '/inbox' && inboxCount > 0 ? String(inboxCount) : undefined}
            />
          ))}
        </nav>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <DrawerLink item={{ href: '/settings', label: 'Settings', Icon: IcSettings, color: '#8ea8c5' }} onClick={onClose} active={isActive('/settings')} />
          <button
            onClick={() => { onClose(); signOut({ callbackUrl: '/login' }) }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'none', border: 'none', borderRadius: 10, cursor: 'pointer', color: '#ef4444', fontFamily: 'var(--font-system)', fontSize: 14, textAlign: 'left', width: '100%' }}
          >
            <span style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>↩</span>
            Sign out
          </button>
        </div>
      </aside>
      <style>{`
        @keyframes drawerin { from { transform: translateX(-20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
    </div>
  )
}

function DrawerLink({ item, onClick, badge, active }: { item: MenuItem; onClick: () => void; badge?: string; active?: boolean }) {
  const activeBg = active ? `${item.color || '#52749a'}1f` : 'transparent'
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 10,
        textDecoration: 'none',
        color: '#eef3fa',
        fontFamily: 'var(--font-system)',
        fontSize: 14,
        fontWeight: active ? 600 : 400,
        background: activeBg,
        borderLeft: active ? `3px solid ${item.color || '#f59e0b'}` : '3px solid transparent',
        paddingLeft: 9,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      <span style={{ width: 28, height: 28, borderRadius: 8, background: `${item.color || '#52749a'}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <item.Icon size={15} color={item.color || '#8ea8c5'} />
      </span>
      <span style={{ flex: 1 }}>{item.label}</span>
      {badge && (
        <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10, minWidth: 18, textAlign: 'center', fontFamily: 'var(--font-system)' }}>
          {badge}
        </span>
      )}
    </Link>
  )
}

const menuLabel: React.CSSProperties = {
  fontFamily: 'var(--font-system)',
  fontSize: 10,
  fontWeight: 700,
  color: '#52749a',
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  padding: '4px 12px 0',
}
