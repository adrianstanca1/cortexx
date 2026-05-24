'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import TabBar from '@/components/ui/TabBar'
import { IcSpark, IcChevL, IcSend, IcTrash, IcAlert } from '@/components/ui/Icons'

interface Message {
  role: 'user' | 'assistant'
  content: string
  model?: string
  durationMs?: number
  error?: boolean
}

interface LlmInfo { model: string; baseUrl: string }

const SF = 'var(--font-system)'
const STORAGE_PREFIX = 'cortexx-ask-history-v1:'
const MAX_PERSISTED = 40
const MAX_HISTORY_SENT = 20
const SUGGESTIONS = [
  "What's the status of my active projects?",
  'Which snags are still open and which are critical?',
  'How many timesheet entries need approval this week?',
  'Summarise this week\'s site activity.',
  'What CSCS cards are expiring in the next 60 days?',
]

function isMessage(m: unknown): m is Message {
  if (!m || typeof m !== 'object') return false
  const r = (m as { role?: unknown }).role
  const c = (m as { content?: unknown }).content
  return (r === 'user' || r === 'assistant') && typeof c === 'string' && c.length > 0
}

// Strip error-flagged assistant bubbles before persisting or sending — they're
// outage notices, not real assistant turns, and re-feeding them poisons the
// next prompt.
function pruneForHistory(messages: Message[]): Message[] {
  return messages.filter(m => !m.error)
}

export default function AskCortexPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const userKey = session?.user
    ? (session.user as { id?: string }).id || session.user.email || null
    : null
  const storageKey = userKey ? `${STORAGE_PREFIX}${userKey}` : null

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [llmInfo, setLlmInfo] = useState<LlmInfo | null>(null)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [restored, setRestored] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const composingRef = useRef(false)

  // Redirect unauthenticated users — every other authed surface assumes
  // session.user is present.
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.replace('/login?callbackUrl=/ask')
  }, [sessionStatus, router])

  // Restore history once the session resolves, using the per-user key.
  useEffect(() => {
    if (!storageKey) return
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(isMessage)
          if (valid.length > 0) setMessages(valid)
        }
      }
    } catch {}
    setRestored(true)
    fetch('/api/ask')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.model) setLlmInfo(d) })
      .catch(() => {})
  }, [storageKey])

  // Persist only after the initial restore has run, so we never overwrite
  // a user's saved thread with the empty initial state.
  useEffect(() => {
    if (!restored || !storageKey) return
    try {
      const toSave = pruneForHistory(messages).slice(-MAX_PERSISTED)
      localStorage.setItem(storageKey, JSON.stringify(toSave))
    } catch {}
  }, [messages, restored, storageKey])

  // Auto-scroll on any change to messages or the typing indicator.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, sending])

  const send = useCallback(async (text: string) => {
    const message = text.trim()
    if (!message || sending) return
    setUnavailable(null)
    setInput('')
    setSending(true)

    // Snapshot the history BEFORE we append, then strip error bubbles so the
    // model isn't conditioned on prior outage notices.
    const historyToSend = pruneForHistory(messages).slice(-MAX_HISTORY_SENT)
    setMessages(prev => [...prev, { role: 'user', content: message }])

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: historyToSend }),
      })
      const data = await res.json().catch(() => ({} as Record<string, unknown>))
      if (!res.ok) {
        const errMsg = typeof data.error === 'string' ? data.error : 'Something went wrong'
        if (res.status === 401) {
          router.replace('/login?callbackUrl=/ask')
          return
        }
        if (res.status === 503 && data.code === 'LLM_UNAVAILABLE') {
          setUnavailable(errMsg)
        }
        setMessages(prev => [...prev, { role: 'assistant', content: errMsg, error: true }])
        return
      }
      const content = typeof data.content === 'string' && data.content.length > 0
        ? data.content
        : null
      if (!content) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Model returned no content. Try rephrasing.', error: true }])
        return
      }
      setMessages(prev => [...prev, {
        role: 'assistant',
        content,
        model: typeof data.model === 'string' ? data.model : undefined,
        durationMs: typeof data.durationMs === 'number' ? data.durationMs : undefined,
      }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: e instanceof Error ? e.message : 'Network error', error: true }])
    } finally {
      setSending(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [sending, messages, router])

  const clear = () => {
    if (!confirm('Clear conversation history?')) return
    setMessages([])
    if (storageKey) {
      try { localStorage.removeItem(storageKey) } catch {}
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return
    // Don't intercept Enter while an IME composition is active (CJK input,
    // accented input on some keyboards). Both modern `isComposing` and the
    // legacy keyCode 229 sentinel are checked.
    if (composingRef.current || e.nativeEvent.isComposing || e.keyCode === 229) return
    e.preventDefault()
    send(input)
  }

  const visibleMessages = useMemo(() => messages, [messages])

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', display: 'flex', flexDirection: 'column', paddingBottom: 80 }}>
      <style>{`@keyframes cortex-pulse { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.8) } 40% { opacity: 1; transform: scale(1) } }`}</style>
      <div style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: SF, fontSize: 13, color: '#52749a' }}>Apps</span>
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF, display: 'flex', alignItems: 'center', gap: 8 }}>
              <IcSpark size={20} color="#8b5cf6" /> Ask Cortex
            </h1>
            <p style={{ fontSize: 11, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {llmInfo ? <>Local LLM · <span style={{ fontFamily: 'ui-monospace, monospace' }}>{llmInfo.model}</span></> : 'Local LLM via Ollama'}
            </p>
          </div>
          {visibleMessages.length > 0 && (
            <button onClick={clear} aria-label="Clear conversation" style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '5px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <IcTrash size={11} color="#52749a" />
              <span style={{ fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 600 }}>Clear</span>
            </button>
          )}
        </div>
      </div>

      {unavailable && (
        <div style={{ margin: '12px 16px 0', padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.35)', borderRadius: 10, fontFamily: SF, fontSize: 12, color: '#fca5a5', lineHeight: 1.4, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <IcAlert size={12} color="#ef4444" />
          <span>{unavailable}</span>
        </div>
      )}

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {visibleMessages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center', gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: 'rgba(139,92,246,0.15)', border: '0.5px solid rgba(139,92,246,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IcSpark size={28} color="#8b5cf6" />
            </div>
            <div>
              <div style={{ fontFamily: SF, fontSize: 18, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.2 }}>Ask anything about your workspace</div>
              <div style={{ fontFamily: SF, fontSize: 13, color: '#8ea8c5', marginTop: 4, lineHeight: 1.4 }}>
                Cortex sees your active projects, open snags, pending timesheets and recent activity. Try:
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 420 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} style={{ background: '#152641', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 14px', textAlign: 'left', fontFamily: SF, fontSize: 13, color: '#c1d2e8', cursor: 'pointer' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {visibleMessages.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 4 }}>
            <div style={{
              maxWidth: '88%',
              padding: '10px 14px',
              borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: m.error ? 'rgba(239,68,68,0.12)' : m.role === 'user' ? '#8b5cf6' : '#152641',
              border: m.error ? '0.5px solid rgba(239,68,68,0.4)' : m.role === 'user' ? 'none' : '0.5px solid rgba(255,255,255,0.07)',
              color: m.error ? '#fca5a5' : m.role === 'user' ? '#fff' : '#eef3fa',
              fontFamily: SF,
              fontSize: 14,
              lineHeight: 1.45,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
            }}>
              {m.error && <span aria-label="Error" role="img" style={{ flexShrink: 0, marginTop: 2 }}><IcAlert size={12} color="#ef4444" /></span>}
              <span>{m.content}</span>
            </div>
            {(m.model || m.durationMs !== undefined) && (
              <div style={{ fontFamily: SF, fontSize: 10, color: '#52749a' }}>
                {m.model && <span style={{ fontFamily: 'ui-monospace, monospace' }}>{m.model}</span>}
                {m.model && m.durationMs !== undefined && ' · '}
                {m.durationMs !== undefined && `${(m.durationMs / 1000).toFixed(1)}s`}
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: '#152641', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Dot delay={0} />
              <Dot delay={150} />
              <Dot delay={300} />
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '8px 16px 12px', background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderTop: '0.5px solid rgba(255,255,255,0.07)', flexShrink: 0, position: 'sticky', bottom: 70 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onCompositionStart={() => { composingRef.current = true }}
            onCompositionEnd={() => { composingRef.current = false }}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything…"
            rows={1}
            style={{ flex: 1, background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 14px', color: '#eef3fa', fontFamily: SF, fontSize: 14, outline: 'none', resize: 'none', maxHeight: 140, minHeight: 40 }}
          />
          <button onClick={() => send(input)} disabled={sending || !input.trim()} aria-label="Send" style={{ width: 40, height: 40, borderRadius: 12, background: input.trim() && !sending ? '#8b5cf6' : 'rgba(139,92,246,0.3)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() && !sending ? 'pointer' : 'not-allowed', flexShrink: 0 }}>
            <IcSend size={18} color="#fff" />
          </button>
        </div>
      </div>

      <TabBar />
    </div>
  )
}

function Dot({ delay }: { delay: number }) {
  return (
    <span style={{ width: 6, height: 6, borderRadius: 3, background: '#8b5cf6', animation: 'cortex-pulse 1.2s ease-in-out infinite', animationDelay: `${delay}ms`, display: 'inline-block' }} />
  )
}
