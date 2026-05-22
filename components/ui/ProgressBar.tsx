'use client'

interface ProgressBarProps {
  value: number
  color?: string
  height?: number
  showLabel?: boolean
  bg?: string
  animated?: boolean
}

export default function ProgressBar({
  value,
  color = '#f59e0b',
  height = 4,
  showLabel = false,
  bg = 'rgba(255,255,255,0.08)',
  animated = false,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div style={{ width: '100%' }}>
      {showLabel && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color,
              fontFamily: 'var(--font-system)',
            }}
          >
            {clamped}%
          </span>
        </div>
      )}
      <div
        style={{
          width: '100%',
          height,
          borderRadius: height,
          background: bg,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${clamped}%`,
            borderRadius: height,
            background: color,
            transition: animated ? 'width 0.6s ease' : 'none',
            boxShadow: `0 0 6px ${color}66`,
          }}
        />
      </div>
    </div>
  )
}
