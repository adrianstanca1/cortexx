'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Hint = null | 'ios' | 'native'

const STORAGE_KEY = 'cortexx:install-hint-dismissed'

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  // iPadOS 13+ reports as Mac; check touch points to distinguish.
  const ua = navigator.userAgent
  const iosUa = /iPhone|iPad|iPod/.test(ua)
  const iPadOS = ua.includes('Macintosh') && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1
  return iosUa || iPadOS
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if ((navigator as Navigator & { standalone?: boolean }).standalone) return true
  return window.matchMedia('(display-mode: standalone)').matches
}

export default function InstallHint() {
  const [hint, setHint] = useState<Hint>(null)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isStandalone()) return
    if (localStorage.getItem(STORAGE_KEY) === '1') return

    if (isIos()) {
      // Wait 4s before nudging — don't interrupt the first impression
      const t = setTimeout(() => setHint('ios'), 4000)
      return () => clearTimeout(t)
    }

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setHint('native')
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (!hint) return null

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setHint(null)
  }

  const install = async () => {
    if (deferred) {
      await deferred.prompt()
      await deferred.userChoice
    }
    dismiss()
  }

  return (
    <div
      role="dialog"
      aria-label="Install Cortexx"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(90px + env(safe-area-inset-bottom, 0px))',
        zIndex: 130,
        background: '#0c1a2e',
        border: '1px solid rgba(245,158,11,0.4)',
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
        animation: 'install-in 0.3s ease-out',
      }}
    >
      <div style={{ flex: 1, fontFamily: 'var(--font-system)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#eef3fa' }}>Install Cortexx</div>
        <div style={{ fontSize: 11, color: '#8ea8c5', marginTop: 2 }}>
          {hint === 'ios'
            ? <>Tap <span aria-label="share">⬆</span> then <strong>Add to Home Screen</strong></>
            : 'Get a native app experience'}
        </div>
      </div>
      {hint === 'native' && (
        <button
          onClick={install}
          style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', fontFamily: 'var(--font-system)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          Install
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="Dismiss install hint"
        style={{ background: 'rgba(255,255,255,0.06)', color: '#8ea8c5', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', fontSize: 16, lineHeight: 1, fontFamily: 'var(--font-system)' }}
      >
        ×
      </button>
      <style>{`
        @keyframes install-in { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  )
}
