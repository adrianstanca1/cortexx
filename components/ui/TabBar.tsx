'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IcDashboard, IcProjects, IcTasks, IcTeam } from './Icons'

interface TabBarProps { accent?: string }

const tabs = [
  { href: '/dashboard', label: 'Command', Icon: IcDashboard },
  { href: '/projects', label: 'Projects', Icon: IcProjects },
  { href: '#fab-spacer', label: '', Icon: IcDashboard, isFabSpacer: true },
  { href: '/tasks', label: 'Work', Icon: IcTasks },
  { href: '/team', label: 'People', Icon: IcTeam },
]

export default function TabBar({ accent = 'var(--accent)' }: TabBarProps) {
  const pathname = usePathname()
  return (
    <nav aria-label="Primary" className="primary-nav">
      <div className="primary-nav-inner">
        {tabs.map(({ href, label, Icon, isFabSpacer }) => {
          if (isFabSpacer) return <div key="fab-spacer" aria-hidden="true" />
          const isActive = pathname.startsWith(href)
          return (
            <Link key={href} href={href} aria-current={isActive ? 'page' : undefined}
              className="primary-nav-link" data-active={isActive ? 'true' : 'false'}>
              <Icon size={21} color={isActive ? accent : 'currentColor'} />
              <span className="primary-nav-label">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
