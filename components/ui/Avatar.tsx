'use client'

interface AvatarProps {
  name: string
  color?: string
  size?: number
  fontSize?: number
  ring?: boolean
  ringColor?: string
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 37, g: 99, b: 235 }
}

export default function Avatar({
  name,
  color = '#2563eb',
  size = 36,
  fontSize,
  ring = false,
  ringColor,
}: AvatarProps) {
  const initials = getInitials(name)
  const rgb = hexToRgb(color)
  const computedFontSize = fontSize || Math.floor(size * 0.36)

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `linear-gradient(135deg, rgba(${rgb.r},${rgb.g},${rgb.b},0.9), rgba(${rgb.r},${rgb.g},${rgb.b},0.5))`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        border: ring ? `2px solid ${ringColor || '#06101e'}` : 'none',
        boxShadow: ring ? `0 0 0 1px ${color}44` : 'none',
      }}
    >
      <span
        style={{
          fontSize: computedFontSize,
          fontWeight: 700,
          color: '#fff',
          fontFamily: 'var(--font-system)',
          letterSpacing: '0.02em',
          userSelect: 'none',
        }}
      >
        {initials}
      </span>
    </div>
  )
}
