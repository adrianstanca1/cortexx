'use client'

import { useEffect } from 'react'

/**
 * When `open` becomes true:
 * - Locks body scroll
 * - Calls `onClose` when Escape is pressed
 * - Restores everything when `open` is false or on unmount
 */
export function useModalEffects(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
}
