'use client'

interface Segment {
  value: string
  label: string
}

interface SegmentedControlProps {
  id?: string
  value: string
  onChange: (value: string) => void
  options: Segment[]
  size?: 'sm' | 'md'
  ariaLabel?: string
  ariaLabelledBy?: string
}

/**
 * Pill-style single-select switch with a sliding active background.
 */
export default function SegmentedControl({
  id,
  value,
  onChange,
  options,
  size = 'md',
  ariaLabel,
  ariaLabelledBy,
}: SegmentedControlProps) {
  const activeIndex = options.findIndex((o) => o.value === value)
  const font = 'var(--font-system)'
  const height = size === 'sm' ? 32 : 40
  const padding = size === 'sm' ? '0 12px' : '0 16px'

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      style={{
        display: 'inline-flex',
        position: 'relative',
        background: 'var(--bg3)',
        borderRadius: height / 2,
        border: '1px solid rgba(255,255,255,0.08)',
        padding: 3,
      }}
    >
      {activeIndex >= 0 && (
        <div
          style={{
            position: 'absolute',
            top: 3,
            bottom: 3,
            left: 3,
            height: height - 6,
            width: `calc((100% - 6px) / ${options.length})`,
            transform: `translateX(calc(${activeIndex} * 100%))`,
            background: 'rgba(255,255,255,0.12)',
            borderRadius: (height - 6) / 2,
            transition: 'transform 200ms cubic-bezier(0.16,1,0.3,1)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }}
        />
      )}
      {options.map((o) => {
        const isActive = o.value === value
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(o.value)}
            style={{
              position: 'relative',
              zIndex: 1,
              height,
              padding,
              border: 0,
              background: 'transparent',
              color: isActive ? 'var(--t1)' : 'var(--t3)',
              fontFamily: font,
              fontSize: size === 'sm' ? 12 : 13,
              fontWeight: isActive ? 700 : 500,
              cursor: 'pointer',
              borderRadius: height / 2,
              transition: 'color 150ms ease',
              whiteSpace: 'nowrap',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
