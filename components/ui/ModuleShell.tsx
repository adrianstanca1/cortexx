'use client'

/**
 * Shared module shell — the visual frame that wraps the 24 parity-with-
 * legacy module pages. Provides the title, tagline, "back to /apps"
 * link, and a single action button slot. Keeps the dozens of generated
 * pages visually consistent without duplicating 30 lines of styling per
 * file.
 */
import Link from 'next/link'
import { IcChevL } from '@/components/ui/Icons'

interface Props {
  title: string
  tagline: string
  action?: { label: string; onClick: () => void } | null
  children: React.ReactNode
}

export default function ModuleShell({ title, tagline, action, children }: Props) {
  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', padding: '20px 20px 100px 60px' }}>
      <Link href="/apps" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 12 }}>
        <IcChevL size={18} color="#52749a" />
        <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>All apps</span>
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)', margin: 0 }}>
            {title}
          </h1>
          <p style={{ fontSize: 13, color: '#8ea8c5', fontFamily: 'var(--font-system)', margin: '4px 0 0' }}>
            {tagline}
          </p>
        </div>
        {action && (
          <button
            onClick={action.onClick}
            style={{ flexShrink: 0, padding: '8px 16px', borderRadius: 10, background: '#f59e0b', border: 'none', color: '#06101e', fontFamily: 'var(--font-system)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            {action.label}
          </button>
        )}
      </div>

      {children}
    </div>
  )
}
