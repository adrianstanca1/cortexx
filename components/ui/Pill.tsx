'use client'

interface PillProps {
  label: string
  color?: string
  ghost?: boolean
  size?: 'sm' | 'md'
  dot?: boolean
}

const statusColors: Record<string, string> = {
  active: '#10b981',
  snagging: '#f59e0b',
  quoting: '#8b5cf6',
  complete: '#52749a',
  todo: '#52749a',
  in_progress: '#2563eb',
  done: '#10b981',
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#ef4444',
  sent: '#2563eb',
  paid: '#10b981',
  overdue: '#ef4444',
  draft: '#52749a',
}

export default function Pill({ label, color, ghost = false, size = 'sm', dot = false }: PillProps) {
  const resolvedColor = color || statusColors[label.toLowerCase()] || '#52749a'

  const paddingX = size === 'sm' ? '6px' : '10px'
  const paddingY = size === 'sm' ? '2px' : '5px'
  const fontSize = size === 'sm' ? 10 : 12

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: dot ? 4 : 0,
        padding: `${paddingY} ${paddingX}`,
        borderRadius: 99,
        fontSize,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        fontFamily: 'var(--font-system)',
        background: ghost ? 'transparent' : `${resolvedColor}22`,
        color: resolvedColor,
        border: ghost ? `1px solid ${resolvedColor}66` : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {dot && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: resolvedColor,
            display: 'inline-block',
          }}
        />
      )}
      {label}
    </span>
  )
}
