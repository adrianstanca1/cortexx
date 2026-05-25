'use client'

/**
 * AI history — recent prompts to /ask Cortex. Until we persist the
 * conversation log to Postgres, this reads from sessionStorage where
 * the Ask page stashes drafts. Future: back this with an AiInteraction
 * table that captures prompt + response + model + latency.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import { IcChevL, IcSpark } from '@/components/ui/Icons'

interface HistoryEntry {
  id: string
  prompt: string
  response?: string
  ts: number
}

export default function AiHistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('cortexx_ask_history')
      if (raw) {
        const parsed: HistoryEntry[] = JSON.parse(raw)
        setEntries(parsed.sort((a, b) => b.ts - a.ts).slice(0, 50))
      }
    } catch { /* ignore */ }
  }, [])

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 12 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>All apps</span>
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)', margin: 0 }}>
          AI history
        </h1>
        <p style={{ fontSize: 13, color: '#8ea8c5', fontFamily: 'var(--font-system)', margin: '4px 0 0' }}>
          Your recent prompts to <Link href="/ask" style={{ color: '#8b5cf6', textDecoration: 'none' }}>Ask Cortex</Link>.
        </p>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {entries.length === 0 ? (
          <div style={{ color: '#52749a', fontSize: 13, padding: 60, textAlign: 'center', fontFamily: 'var(--font-system)' }}>
            <IcSpark size={32} color="#8b5cf6" />
            <p style={{ marginTop: 12 }}>No prompts yet.<br /><Link href="/ask" style={{ color: '#f59e0b', textDecoration: 'none' }}>Ask Cortex something →</Link></p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.map(e => (
              <li key={e.id} style={{ background: '#152641', borderRadius: 12, padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.07)', fontFamily: 'var(--font-system)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <IcSpark size={14} color="#8b5cf6" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#eef3fa' }}>{e.prompt}</div>
                    {e.response && (
                      <div style={{ fontSize: 12, color: '#8ea8c5', marginTop: 6, lineHeight: 1.5 }}>
                        {e.response.length > 200 ? e.response.slice(0, 200) + '…' : e.response}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: '#52749a', marginTop: 6 }}>
                      {new Date(e.ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <TabBar />
    </div>
  )
}
