'use client'

/**
 * AI history — persisted conversation log from /api/ai/history.
 * Previously read from localStorage; now backed by the ai_history
 * SQL table via the Express API.
 */
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcChevL, IcSpark, IcTrash } from '@/components/ui/Icons'

interface HistoryEntry {
  id: string
  user_msg: string | null
  ai_reply: string | null
  created_at: string
}

export default function AiHistoryPage() {
  const { status: sessionStatus } = useSession()
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/history?limit=50')
      if (!res.ok) throw new Error('Failed to load history')
      const data = await res.json()
      setEntries(data.history || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionStatus === 'authenticated') fetchHistory()
    else if (sessionStatus !== 'loading') setLoading(false)
  }, [sessionStatus, fetchHistory])

  const clearHistory = useCallback(async () => {
    if (!confirm('Delete all AI conversation history? This cannot be undone.')) return
    try {
      const res = await fetch('/api/ai/history', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to clear history')
      setEntries([])
      setToast('History cleared')
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Failed to clear')
    }
  }, [])

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' +
           d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 12 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>All apps</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)', margin: 0 }}>
              AI history
            </h1>
            <p style={{ fontSize: 13, color: '#8ea8c5', fontFamily: 'var(--font-system)', margin: '4px 0 0' }}>
              Your prompts to <Link href="/ask" style={{ color: '#8b5cf6', textDecoration: 'none' }}>Ask Cortex</Link>.
              {!loading && entries.length > 0 && ` ${entries.length} conversation${entries.length === 1 ? '' : 's'} saved.`}
            </p>
          </div>
          {entries.length > 0 && (
            <button
              onClick={clearHistory}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#ef4444', opacity: 0.7 }}
              title="Clear all history"
            >
              <IcTrash size={18} color="#ef4444" />
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {loading ? (
          <p style={{ color: '#52749a', padding: 40, textAlign: 'center', fontFamily: 'var(--font-system)', fontSize: 13 }}>Loading…</p>
        ) : error ? (
          <p style={{ color: '#ef4444', padding: 40, textAlign: 'center', fontFamily: 'var(--font-system)', fontSize: 13 }}>{error}</p>
        ) : entries.length === 0 ? (
          <div style={{ color: '#52749a', fontSize: 13, padding: 60, textAlign: 'center', fontFamily: 'var(--font-system)' }}>
            <IcSpark size={32} color="#8b5cf6" />
            <p style={{ marginTop: 12 }}>No prompts yet.<br /><Link href="/ask" style={{ color: '#f59e0b', textDecoration: 'none' }}>Ask Cortex something →</Link></p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.map((e) => (
              <li key={e.id} style={{ background: '#152641', borderRadius: 12, padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.07)', fontFamily: 'var(--font-system)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <IcSpark size={14} color="#8b5cf6" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {e.user_msg && (
                      <div style={{ fontSize: 13, color: '#eef3fa', fontWeight: 600 }}>{e.user_msg}</div>
                    )}
                    {e.ai_reply && (
                      <div style={{ fontSize: 12, color: '#8ea8c5', marginTop: 6, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {e.ai_reply.length > 240 ? e.ai_reply.slice(0, 240) + '…' : e.ai_reply}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: '#52749a', marginTop: 6 }}>
                      {fmtDate(e.created_at)}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <TabBar />
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}