'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IcDashboard, IcProjects, IcTasks, IcTeam } from './Icons'

interface TabBarProps {
  accent?: string
}

const tabs = [
  { href: '/dashboard', label: 'Dashboard', Icon: IcDashboard },
  { href: '/projects', label: 'Projects', Icon: IcProjects },
  { href: '#fab-spacer', label: '', Icon: IcDashboard, isFabSpacer: true },
  { href: '/tasks', label: 'Tasks', Icon: IcTasks },
  { href: '/team', label: 'Team', Icon: IcTeam },
]

export default function TabBar({ accent = '#f59e0b' }: TabBarProps) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary"
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '480px',
        background: 'rgba(12,26,46,0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-around',
          padding: '8px 0 12px',
          height: 64,
        }}
      >
        {tabs.map(({ href, label, Icon, isFabSpacer }) => {
          if (isFabSpacer) {
            // Reserve space for the floating QuickActions FAB
            return <div key="fab-spacer" style={{ width: 60, flexShrink: 0 }} aria-hidden="true" />
          }
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '4px 12px',
                flex: 1,
                textDecoration: 'none',
                transition: 'opacity 0.15s',
              }}
            >
              <Icon size={22} color={isActive ? accent : '#52749a'} />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? accent : '#52749a',
                  letterSpacing: '0.02em',
                  fontFamily: 'var(--font-system)',
                }}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
