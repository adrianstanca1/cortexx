'use client'

/**
 * AI history — recent prompts to /ask Cortex. Reads the same
 * localStorage namespace that /ask writes to:
 * `cortexx-ask-history-v1:<userKey>`. Pairs user prompts with the
 * assistant response that immediately followed.
 *
 * When we land a persisted AiInteraction Prisma model, swap the
 * localStorage read for a /api/ask/history call.
 */
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import { IcChevL, IcSpark } from '@/components/ui/Icons'

interface Message {
  role: 'user' | 'assistant'
  content: string
  model?: string
  durationMs?: number
  error?: boolean
}

interface Turn {
  id: string
  prompt: string
  response: string | null
  model: string | null
  durationMs: number | null
}

const STORAGE_PREFIX = 'cortexx-ask-history-v1:'

export default function AiHistoryPage() {
  const { data: session, status: sessionStatus } = useSession()
  const [turns, setTurns] = useState<Turn[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return
    const userKey = (session?.user as { id?: string } | undefined)?.id || session?.user?.email
    if (!userKey) { setHydrated(true); return }
    try {
      const raw = window.localStorage.getItem(STORAGE_PREFIX + userKey)
      if (!raw) { setHydrated(true); return }
      const messages: Message[] = JSON.parse(raw)
      // Pair each user message with the next assistant message
      const paired: Turn[] = []
      for (let i = 0; i < messages.length; i++) {
        const m = messages[i]
        if (m.role !== 'user') continue
        const next = messages[i + 1]
        const ai = next && next.role === 'assistant' ? next : null
        paired.push({
          id: String(i),
          prompt: m.content,
          response: ai?.content ?? null,
          model: ai?.model ?? null,
          durationMs: ai?.durationMs ?? null,
        })
      }
      // Newest first
      setTurns(paired.reverse())
    } catch { /* corrupted, ignore */ }
    finally { setHydrated(true) }
  }, [sessionStatus, session?.user])

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
          Your recent prompts to <Link href="/ask" style={{ color: '#8b5cf6', textDecoration: 'none' }}>Ask Cortex</Link>. {hydrated && turns.length > 0 && `${turns.length} turn${turns.length === 1 ? '' : 's'} stored on this device.`}
        </p>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {!hydrated ? (
          <p style={{ color: '#52749a', padding: 40, textAlign: 'center', fontFamily: 'var(--font-system)', fontSize: 13 }}>Loading…</p>
        ) : turns.length === 0 ? (
          <div style={{ color: '#52749a', fontSize: 13, padding: 60, textAlign: 'center', fontFamily: 'var(--font-system)' }}>
            <IcSpark size={32} color="#8b5cf6" />
            <p style={{ marginTop: 12 }}>No prompts yet on this device.<br /><Link href="/ask" style={{ color: '#f59e0b', textDecoration: 'none' }}>Ask Cortex something →</Link></p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {turns.map(t => (
              <li key={t.id} style={{ background: '#152641', borderRadius: 12, padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.07)', fontFamily: 'var(--font-system)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <IcSpark size={14} color="#8b5cf6" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#eef3fa', fontWeight: 600 }}>{t.prompt}</div>
                    {t.response && (
                      <div style={{ fontSize: 12, color: '#8ea8c5', marginTop: 6, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {t.response.length > 240 ? t.response.slice(0, 240) + '…' : t.response}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: '#52749a', marginTop: 6, display: 'flex', gap: 8 }}>
                      {t.model && <span>{t.model}</span>}
                      {t.durationMs && <span>{(t.durationMs / 1000).toFixed(1)}s</span>}
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
