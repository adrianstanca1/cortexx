'use client'

import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import UserMenu from './UserMenu'
import QuickActions from './QuickActions'

/**
 * Wraps authenticated UI chrome: the floating UserMenu top-right and
 * the QuickActions FAB bottom-center. Both are hidden on the auth
 * pages (/login, /register).
 */
export default function AuthedShell() {
  const { data: session } = useSession()
  const pathname = usePathname()
  if (!session?.user) return null
  if (pathname === '/login' || pathname === '/register') return null
  return (
    <>
      <UserMenu />
      <QuickActions />
    </>
  )
}
