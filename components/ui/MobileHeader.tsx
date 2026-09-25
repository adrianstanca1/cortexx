'use client'

import { IcBell, IcSearch } from './Icons'

interface MobileHeaderProps {
  title: string
  subtitle?: string
  notifCount?: number
  onSearch?: () => void
  onNotif?: () => void
  rightSlot?: React.ReactNode
}

export default function MobileHeader({
  title,
  subtitle,
  notifCount = 0,
  onSearch,
  onNotif,
  rightSlot,
}: MobileHeaderProps) {
  return (
    <header className="module-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
      <div style={{ minWidth: 0 }}>
        <div className="section-kicker">Workspace command</div>
        <h1 style={{ color: 'var(--t1)', lineHeight: 1, marginTop: 5 }}>{title}</h1>
        {subtitle && (
          <p style={{ fontSize: 11.5, color: 'var(--t2)', marginTop: 5, fontFamily: 'var(--font-system)' }}>
            {subtitle}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
        {rightSlot}
        {onSearch && (
          <button type="button" onClick={onSearch} aria-label="Search" className="command-icon-btn">
            <IcSearch size={17} color="currentColor" />
          </button>
        )}
        {onNotif && (
          <button
            type="button"
            onClick={onNotif}
            aria-label={notifCount > 0 ? `${notifCount} unread notifications` : 'Notifications'}
            className="command-icon-btn"
            style={{ position: 'relative' }}
          >
            <IcBell size={17} color={notifCount > 0 ? 'var(--accent)' : 'currentColor'} />
            {notifCount > 0 && (
              <span style={{
                position: 'absolute', top: 5, right: 5, width: 7, height: 7,
                borderRadius: '50%', background: 'var(--red)', border: '1.5px solid var(--bg0)',
              }} />
            )}
          </button>
        )}
      </div>
    </header>
  )
}
