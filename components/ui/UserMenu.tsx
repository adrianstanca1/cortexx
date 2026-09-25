'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'

/**
 * Floating user chip in the top-right of authenticated pages.
 * Click → menu with profile/sign-out.
 */
export default function UserMenu() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  if (!session?.user) return null

  const initial = (session.user.name || session.user.email || 'U').trim().charAt(0).toUpperCase()
  const label = session.user.name || session.user.email?.split('@')[0] || 'User'

  return (
    <div ref={ref} style={{ position: 'fixed', top: 12, right: 12, zIndex: 200 }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="User menu"
        aria-expanded={open}
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent), #48d8ff)',
          border: '1px solid rgba(215,255,63,.35)',
          color: '#090b0d',
          fontFamily: 'var(--font-system)',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 0 5px rgba(215,255,63,.07), 0 8px 24px rgba(0,0,0,.38)',
        }}
      >
        {initial}
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 44,
            right: 0,
            minWidth: 200,
            background: 'linear-gradient(180deg, rgba(28,34,39,.99), rgba(14,18,21,.99))',
            border: '1px solid var(--hairMid)',
            borderRadius: 12,
            boxShadow: '0 18px 50px rgba(0,0,0,.5)',
            overflow: 'hidden',
            fontFamily: 'var(--font-system)',
          }}
        >
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{label}</div>
            {session.user.email && (
              <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>{session.user.email}</div>
            )}
            {session.user.role === 'admin' && (
              <div style={{ marginTop: 4, display: 'inline-block', background: 'rgba(215,255,63,.12)', color: 'var(--accent)', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                admin
              </div>
            )}
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            role="menuitem"
            style={{ display: 'block', padding: '11px 16px', color: 'var(--t1)', fontSize: 13, textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            Account settings
          </Link>
          <button
            onClick={() => { setOpen(false); signOut({ callbackUrl: '/login' }) }}
            role="menuitem"
            style={{ display: 'block', width: '100%', padding: '11px 16px', background: 'none', border: 'none', color: '#ef4444', fontSize: 13, textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font-system)' }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
