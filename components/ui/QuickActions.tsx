'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { IcPlus, IcX, IcCheck, IcReceipt, IcDoc, IcCamera, IcHardhat, IcProjects } from './Icons'

interface Action {
  id: string
  label: string
  sub: string
  color: string
  Icon: React.ComponentType<{ size?: number; color?: string }>
  href: string
}

const actions: Action[] = [
  { id: 'capture', label: 'Capture', sub: 'Photo, voice, receipt or incident', color: '#f59e0b', Icon: IcCamera, href: '/capture' },
  { id: 'task', label: 'New task', sub: 'Add to a project', color: '#2563eb', Icon: IcCheck, href: '/tasks?new=1' },
  { id: 'project', label: 'New project', sub: 'Start a new site', color: '#10b981', Icon: IcProjects, href: '/projects?new=1' },
  { id: 'member', label: 'Add team member', sub: 'Invite or onboard', color: '#8b5cf6', Icon: IcHardhat, href: '/team?new=1' },
  { id: 'document', label: 'New document', sub: 'RAMS, report, permit…', color: '#06b6d4', Icon: IcDoc, href: '/documents?new=1' },
  { id: 'invoice', label: 'New invoice', sub: 'Pick a project on the next screen', color: '#ec4899', Icon: IcReceipt, href: '/projects' },
]

interface QuickActionsProps {
  accent?: string
}

/**
 * Bottom-sheet quick-action menu — replaces the single-target FAB.
 * Tap the floating + → sheet slides up with categorised shortcuts.
 */
export default function QuickActions({ accent = '#f59e0b' }: QuickActionsProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      {/* FAB sits inside the TabBar visually, but it's a separate fixed-position button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Quick actions"
        aria-expanded={open}
        style={{
          position: 'fixed',
          bottom: 'calc(18px + env(safe-area-inset-bottom, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
          boxShadow: `0 0 22px ${accent}77, 0 4px 14px rgba(0,0,0,0.45)`,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 101,
          transition: 'transform 0.18s',
        }}
      >
        <IcPlus size={26} color="#fff" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
        >
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
          />
          <div
            ref={sheetRef}
            style={{
              position: 'relative',
              background: '#0c1a2e',
              borderRadius: '20px 20px 0 0',
              padding: '20px 16px calc(28px + env(safe-area-inset-bottom, 0px))',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              maxHeight: '85dvh',
              overflowY: 'auto',
              animation: 'qaslide 0.18s ease-out',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.3, fontFamily: 'var(--font-system)' }}>Quick actions</h2>
                <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: 'var(--font-system)' }}>Create or capture from anywhere</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <IcX size={18} color="#8ea8c5" />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
              {actions.map(a => (
                <button
                  key={a.id}
                  onClick={() => go(a.href)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 14px',
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    fontFamily: 'var(--font-system)',
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${a.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <a.Icon size={20} color={a.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.01em' }}>{a.label}</p>
                    <p style={{ fontSize: 12, color: '#8ea8c5', marginTop: 1 }}>{a.sub}</p>
                  </div>
                  <span style={{ color: '#52749a', fontSize: 18 }}>›</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes qaslide {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  )
}
