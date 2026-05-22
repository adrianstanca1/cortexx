'use client'

import { useEffect } from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error'
  onDone: () => void
}

export default function Toast({ message, type = 'success', onDone }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400)
    return () => clearTimeout(t)
  }, [onDone])

  const bg = type === 'success' ? '#10b981' : '#ef4444'

  return (
    <div style={{
      position: 'fixed',
      bottom: 110,
      left: '50%',
      transform: 'translateX(-50%)',
      background: bg,
      color: '#fff',
      fontFamily: 'var(--font-system)',
      fontSize: 14,
      fontWeight: 600,
      padding: '10px 20px',
      borderRadius: 12,
      zIndex: 9999,
      whiteSpace: 'nowrap',
      boxShadow: `0 4px 20px ${bg}66`,
      pointerEvents: 'none',
      animation: 'toastIn 0.2s ease',
    }}>
      {message}
      <style>{`@keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`}</style>
    </div>
  )
}
