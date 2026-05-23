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
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px 12px 60px',
        background: 'rgba(6,16,30,0.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#eef3fa',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            fontFamily: 'var(--font-system)',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: 12,
              color: '#52749a',
              marginTop: 2,
              fontFamily: 'var(--font-system)',
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {rightSlot}
        {onSearch && (
          <button
            onClick={onSearch}
            aria-label="Search"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.07)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <IcSearch size={18} color="#8ea8c5" />
          </button>
        )}
        {onNotif && (
          <button
            onClick={onNotif}
            aria-label={notifCount > 0 ? `${notifCount} unread notifications` : 'Notifications'}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.07)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <IcBell size={18} color="#8ea8c5" />
            {notifCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#ef4444',
                  border: '1.5px solid #06101e',
                }}
              />
            )}
          </button>
        )}
      </div>
    </header>
  )
}
