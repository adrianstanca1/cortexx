'use client'

import { useEffect, useRef, useState } from 'react'
import Button from './Button'
import { useModalEffects } from '@/lib/useModalEffects'

export interface ModalProps {
  open: boolean
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  onClose: () => void
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  confirmLabel?: string
  onConfirm?: () => void | Promise<void>
  danger?: boolean
}

const widths: Record<string, number | string> = {
  sm: 420,
  md: 560,
  lg: 720,
}

/**
 * Accessible modal dialog with built-in focus-trap, ESC close,
 * body scroll lock, and optional confirm footer.
 */
export default function Modal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  size = 'md',
  loading = false,
  confirmLabel = 'Save',
  onConfirm,
  danger = false,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(open)

  useModalEffects(open, onClose)

  // Simple focus trap: keep focus inside the modal while open.
  useEffect(() => {
    if (!open || !panelRef.current) return
    const panel = panelRef.current
    const focusable = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      if (focusable.length <= 1) {
        e.preventDefault()
        return
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (open) setActive(true)
    else {
      const t = setTimeout(() => setActive(false), 220)
      return () => clearTimeout(t)
    }
  }, [open])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      if (!loading) onClose()
    }
  }

  const defaultFooter = onConfirm ? (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 18 }} key="footer">
      <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
      <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
        {confirmLabel}
      </Button>
    </div>
  ) : null

  if (!active) return null

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'rgba(0,0,0,0.55)',
        opacity: open ? 1 : 0,
        transition: 'opacity 200ms ease',
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={{
          width: '100%',
          maxWidth: widths[size],
          background: 'var(--bg1)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: '28px 28px 24px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
          transform: open ? 'scale(1) translateY(0)' : 'scale(0.98) translateY(10px)',
          opacity: open ? 1 : 0,
          transition: 'transform 220ms cubic-bezier(0.16,1,0.3,1), opacity 200ms ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
          <h2
            id="modal-title"
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: -0.4,
              color: 'var(--t1)',
              margin: 0,
            }}
          >
            {title}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close dialog" disabled={loading}>✕</Button>
        </div>
        {description && <p style={{ fontFamily: 'var(--font-system)', fontSize: 14, color: 'var(--t3)', margin: '0 0 18px', lineHeight: 1.45 }}>{description}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
        {footer || defaultFooter}
      </div>
    </div>
  )
}
