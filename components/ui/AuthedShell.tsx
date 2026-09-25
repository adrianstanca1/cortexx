'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import UserMenu from './UserMenu'
import QuickActions from './QuickActions'
import DrawerMenu from './DrawerMenu'
import InstallHint from './InstallHint'
import { IcMenu } from './Icons'

/**
 * Wraps authenticated UI chrome:
 *   - top-left hamburger → DrawerMenu (full navigation, profile, sign out)
 *   - top-right avatar    → UserMenu
 *   - bottom-center +     → QuickActions
 * All hidden on the auth pages (/login, /register).
 */
export default function AuthedShell() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  if (!session?.user) return null
  if (pathname === '/login' || pathname === '/register') return null
  return (
    <>
      <button
        onClick={() => setDrawerOpen(true)}
        aria-label="Open menu"
        aria-expanded={drawerOpen}
        className="shell-menu-btn"
      >
        <IcMenu size={18} color="currentColor" />
      </button>
      <DrawerMenu open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <UserMenu />
      <QuickActions />
      <InstallHint />
    </>
  )
}
