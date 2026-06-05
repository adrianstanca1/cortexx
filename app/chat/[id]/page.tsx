'use client'

import { useState, useEffect, useCallback, useRef, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Avatar from '@/components/ui/Avatar'
import Toast from '@/components/ui/Toast'
import { IcChevL, IcSend, IcTrash } from '@/components/ui/Icons'

interface Project { id: string; name: string }
interface Conversation {
  id: string
  title: string
  kind: string
  projectId: string | null
  archivedAt: string | null
  lastMessageAt: string | null
  createdAt: string
  project?: Project | null
}
interface ChatMessage {
  id: string
  conversationId: string
  authorId: string
  authorName: string
  body: string
  createdAt: string
  editedAt: string | null
}

const SF = 'var(--font-system)'

export default function ChatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [convo, setConvo] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Last-seen createdAt — used as the ?after= cursor when polling for
  // new messages without refetching the whole thread.
  const lastSeenRef = useRef<string | null>(null)

  // Auto-scroll to bottom on first load and whenever a new message
  // arrives. We only auto-scroll if the user is already near the bottom,
  // so reading older messages isn't disrupted by an incoming poll tick.
  const autoScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (nearBottom) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    }
  }, [])

  const loadConvo = useCallback(async () => {
    try {
      const res = await fetch(`/api/conversations/${id}`)
      if (res.status === 404) { setError('Conversation not found'); return }
      if (!res.ok) throw new Error('Failed to load conversation')
      const d = await res.json()
      setConvo(d.item)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    }
  }, [id])

  const loadAllMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/conversations/${id}/messages?take=500`)
      if (!res.ok) throw new Error('Failed to load messages')
      const d = await res.json()
      const items: ChatMessage[] = d.items || []
      setMessages(items)
      if (items.length > 0) lastSeenRef.current = items[items.length - 1].createdAt
      requestAnimationFrame(() => {
        const el = scrollRef.current
        if (el) el.scrollTop = el.scrollHeight
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [id])

  const pollNewMessages = useCallback(async () => {
    const after = lastSeenRef.current
    if (!after) return
    try {
      const res = await fetch(`/api/conversations/${id}/messages?after=${encodeURIComponent(after)}`)
      if (!res.ok) return
      const d = await res.json()
      const fresh: ChatMessage[] = d.items || []
      if (fresh.length === 0) return
      setMessages(prev => {
        const seen = new Set(prev.map(m => m.id))
        const additions = fresh.filter(m => !seen.has(m.id))
        if (additions.length === 0) return prev
        return [...prev, ...additions]
      })
      // Only advance the cursor forward — guards against a poll that
      // started before a send() and returned after, which would
      // otherwise overwrite the newer createdAt with an older one
      // and force a re-poll of the just-sent message on the next tick.
      const candidate = fresh[fresh.length - 1].createdAt
      if (!lastSeenRef.current || candidate > lastSeenRef.current) {
        lastSeenRef.current = candidate
      }
      autoScroll()
    } catch {}
  }, [id, autoScroll])

  useEffect(() => { loadConvo(); loadAllMessages() }, [loadConvo, loadAllMessages])

  // Poll every 5s when the tab is visible. Pauses when hidden.
  useEffect(() => {
    const start = () => {
      if (pollRef.current) return
      pollRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') pollNewMessages()
      }, 5_000)
    }
    const stop = () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') { pollNewMessages(); start() }
      else stop()
    }
    document.addEventListener('visibilitychange', onVis)
    start()
    return () => { document.removeEventListener('visibilitychange', onVis); stop() }
  }, [pollNewMessages])

  const send = async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    try {
      const res = await fetch(`/api/conversations/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Failed')
      const d = await res.json()
      const created: ChatMessage = d.item
      setMessages(prev => prev.some(m => m.id === created.id) ? prev : [...prev, created])
      // Only advance forward — see pollNewMessages comment for why.
      if (!lastSeenRef.current || created.createdAt > lastSeenRef.current) {
        lastSeenRef.current = created.createdAt
      }
      setDraft('')
      requestAnimationFrame(() => {
        const el = scrollRef.current
        if (el) el.scrollTop = el.scrollHeight
      })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Send failed', type: 'error' })
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd-Enter (mac) / Ctrl-Enter (win) → send. Enter alone inserts a
    // newline so multi-line messages still work in the textarea.
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      send()
    }
  }

  const archive = async () => {
    if (!convo) return
    const next = convo.archivedAt ? null : new Date().toISOString()
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archivedAt: next }),
      })
      if (!res.ok) throw new Error('Failed')
      const d = await res.json()
      setConvo(d.item)
      setToast({ msg: next ? 'Archived' : 'Restored' })
    } catch {
      setToast({ msg: 'Failed to update', type: 'error' })
    }
  }

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      router.push('/chat')
    } catch {
      setToast({ msg: 'Delete failed', type: 'error' })
    }
  }

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      {/* Header */}
      <div style={{ padding: '14px 16px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/chat" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 6 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: SF, fontSize: 13, color: '#52749a' }}>All chats</span>
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.3, fontFamily: SF, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {convo?.title || (error ? 'Conversation' : 'Loading…')}
            </h1>
            <p style={{ fontSize: 11, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {convo?.project?.name && <>{convo.project.name} · </>}
              {messages.length} message{messages.length === 1 ? '' : 's'}
              {convo?.archivedAt && <span style={{ color: '#f59e0b', marginLeft: 6 }}>· Archived</span>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {convo && (
              <button onClick={archive} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', color: '#8ea8c5', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                {convo.archivedAt ? 'Restore' : 'Archive'}
              </button>
            )}
            <button onClick={remove} aria-label={confirmDelete ? 'Confirm delete' : 'Delete conversation'} style={{ padding: '6px 10px', borderRadius: 8, background: confirmDelete ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', color: '#ef4444', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <IcTrash size={13} color="#ef4444" />
              {confirmDelete && <span>Sure?</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        {loading ? (
          <div style={{ color: '#52749a', fontFamily: SF, fontSize: 13, textAlign: 'center', padding: 40 }}>Loading…</div>
        ) : error ? (
          <div style={{ color: '#ef4444', fontFamily: SF, fontSize: 13, textAlign: 'center', padding: 40 }}>{error}</div>
        ) : messages.length === 0 ? (
          <div style={{ color: '#52749a', fontFamily: SF, fontSize: 13, textAlign: 'center', padding: '60px 20px' }}>
            <div>No messages yet.</div>
            <div style={{ marginTop: 8, fontSize: 12 }}>Type below to send the first message.</div>
          </div>
        ) : (
          messages.map((m, idx) => {
            const prev = idx > 0 ? messages[idx - 1] : null
            const collapse = prev && prev.authorId === m.authorId && (new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime()) < 5 * 60_000
            return (
              <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 28, flexShrink: 0 }}>
                  {!collapse && <Avatar name={m.authorName} size={28} />}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  {!collapse && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontFamily: SF, fontSize: 12, fontWeight: 700, color: '#eef3fa' }}>{m.authorName}</span>
                      <span style={{ fontFamily: SF, fontSize: 10, color: '#52749a' }}>
                        {new Date(m.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                  <div style={{ fontFamily: SF, fontSize: 14, color: '#c1d2e8', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45 }}>
                    {m.body}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Composer */}
      <div style={{ position: 'sticky', bottom: 0, padding: '10px 12px 14px', background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={convo?.archivedAt ? 'This conversation is archived' : 'Write a message — Cmd-Enter to send'}
            disabled={!!convo?.archivedAt || sending}
            rows={2}
            maxLength={4000}
            style={{
              flex: 1,
              background: '#1a2f4e',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              padding: '10px 12px',
              color: '#eef3fa',
              fontFamily: SF,
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
              resize: 'none',
              opacity: convo?.archivedAt ? 0.5 : 1,
            }}
          />
          <button
            onClick={send}
            disabled={!draft.trim() || sending || !!convo?.archivedAt}
            aria-label="Send"
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#06b6d4',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              opacity: !draft.trim() || sending || convo?.archivedAt ? 0.4 : 1,
              flexShrink: 0,
            }}
          >
            <IcSend size={18} color="#fff" />
          </button>
        </div>
        <div style={{ fontFamily: SF, fontSize: 10, color: '#52749a', marginTop: 4, textAlign: 'right' }}>
          {draft.length}/4000
        </div>
      </div>
    </div>
  )
}
