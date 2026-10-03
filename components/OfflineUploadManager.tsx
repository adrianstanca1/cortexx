'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  flushOfflineUploads,
  getOfflineUploadSummary,
  refreshOfflineUploadScope,
  subscribeOfflineUploadOutbox,
  type OfflineUploadSummary,
} from '@/lib/offline-media-outbox'

const EMPTY: OfflineUploadSummary = { pending: 0, failed: 0, bytes: 0, orgId: null }

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function OfflineUploadManager() {
  const [summary, setSummary] = useState<OfflineUploadSummary>(EMPTY)
  const [online, setOnline] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setSummary(await getOfflineUploadSummary())
    } catch {
      setSummary(EMPTY)
    }
  }, [])

  const sync = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setOnline(false)
      await refresh()
      return
    }
    setSyncing(true)
    try {
      await refreshOfflineUploadScope()
      setSummary(await flushOfflineUploads())
    } catch {
      await refresh()
    } finally {
      setSyncing(false)
    }
  }, [refresh])

  useEffect(() => {
    let alive = true
    const boot = async () => {
      const isOnline = navigator.onLine
      if (!alive) return
      setOnline(isOnline)
      await refreshOfflineUploadScope()
      if (!alive) return
      await refresh()
      if (isOnline) await sync()
    }
    void boot()

    const onOnline = () => {
      setOnline(true)
      void sync()
    }
    const onOffline = () => {
      setOnline(false)
      void refresh()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void sync()
    }
    const unsubscribe = subscribeOfflineUploadOutbox(() => void refresh())
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      unsubscribe()
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh, sync])

  if (summary.pending === 0) return null

  const label = syncing
    ? `Syncing ${summary.pending} saved upload${summary.pending === 1 ? '' : 's'}…`
    : online
      ? `${summary.pending} upload${summary.pending === 1 ? '' : 's'} pending · sync now`
      : `${summary.pending} upload${summary.pending === 1 ? '' : 's'} saved offline`

  return (
    <button
      type="button"
      onClick={() => { if (online && !syncing) void sync() }}
      disabled={!online || syncing}
      aria-live="polite"
      aria-label={label}
      title={summary.failed > 0 ? `${summary.failed} item${summary.failed === 1 ? '' : 's'} need another sync attempt` : label}
      style={{
        position: 'fixed',
        right: 14,
        bottom: 'calc(78px + env(safe-area-inset-bottom, 0px))',
        zIndex: 180,
        maxWidth: 280,
        minHeight: 40,
        borderRadius: 12,
        border: `1px solid ${summary.failed > 0 ? 'rgba(245,158,11,0.55)' : 'rgba(96,165,250,0.45)'}`,
        background: 'rgba(8,18,32,0.94)',
        color: '#dbeafe',
        boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
        padding: '8px 12px',
        fontFamily: 'var(--font-system)',
        fontSize: 12,
        fontWeight: 700,
        textAlign: 'left',
        cursor: online && !syncing ? 'pointer' : 'default',
        opacity: 0.98,
        backdropFilter: 'blur(12px)',
      }}
    >
      <span style={{ display: 'block' }}>{label}</span>
      <span style={{ display: 'block', marginTop: 2, fontSize: 10, fontWeight: 500, color: '#94a3b8' }}>
        {formatBytes(summary.bytes)} kept safely on this device{summary.failed > 0 ? ` · ${summary.failed} retrying` : ''}
      </span>
    </button>
  )
}
