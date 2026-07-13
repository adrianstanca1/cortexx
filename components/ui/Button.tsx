'use client'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: React.ReactNode
}

/**
 * Reusable button matching the Cortexx design system.
 */
export default function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  children,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const palette = {
    primary: { bg: 'var(--amber)', color: '#fff', active: '#d97706' },
    secondary: { bg: 'var(--bg2)', color: 'var(--t2)', active: 'var(--bg3)' },
    danger: { bg: 'rgba(239,68,68,0.15)', color: 'var(--red)', active: 'rgba(239,68,68,0.25)' },
    ghost: { bg: 'transparent', color: 'var(--t3)', active: 'rgba(255,255,255,0.06)' },
  }[variant]

  const padding = size === 'sm' ? '6px 12px' : size === 'lg' ? '14px 0' : '10px 16px'
  const fontSize = size === 'sm' ? 12 : size === 'lg' ? 16 : 13
  const radius = size === 'sm' ? 8 : 12

  return (
    <button
      disabled={disabled || loading}
      style={{
        padding,
        borderRadius: radius,
        background: palette.bg,
        color: palette.color,
        border: variant === 'primary' || variant === 'danger' || variant === 'ghost' ? 'none' : '0.5px solid var(--hair)',
        fontFamily: 'var(--font-system)',
        fontSize,
        fontWeight: 700,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.55 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        transition: 'opacity 0.15s, transform 0.05s',
        ...style,
      }}
      {...rest}
    >
      {loading && <span style={{ width: 14, height: 14, border: `2px solid ${palette.color}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
      {children}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  )
}
