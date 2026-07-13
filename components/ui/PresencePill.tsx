'use client'

import { usePresence } from '@/lib/usePresence'

interface PresencePillProps {
  screen: string
  focus?: string | null
}

/**
 * Show how many other tabs are currently viewing the same screen.
 */
export default function PresencePill({ screen, focus }: PresencePillProps) {
  const { here } = usePresence(screen, focus)
  if (here.length === 0) return null

  const names = here.slice(0, 3).map(p => p.identity.name)
  const extra = here.length - names.length
  const label = extra > 0 ? `${names.join(', ')} +${extra} viewing` : `${names.join(', ')} viewing`

  return (
    <span
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 99,
        background: 'rgba(37,99,235,0.15)',
        color: '#8ea8c5',
        fontFamily: 'var(--font-system)',
        fontSize: 11,
        fontWeight: 500,
      }}
    >
      <span style={{ display: 'flex' }}>
        {here.slice(0, 3).map((p, i) => (
          <span
            key={p.identity.id}
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: p.identity.color,
              border: '2px solid #06101e',
              marginLeft: i > 0 ? -6 : 0,
              display: 'inline-block',
            }}
          />
        ))}
      </span>
      {here.length} viewing
    </span>
  )
}
