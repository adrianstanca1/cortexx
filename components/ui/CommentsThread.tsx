'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Avatar from './Avatar'
import { IcTrash } from './Icons'

interface Comment {
  id: string
  authorId: string
  authorName: string
  body: string
  createdAt: string
}

export default function CommentsThread({ taskId }: { taskId: string }) {
  const { data: session } = useSession()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const userId = (session?.user as { id?: string } | undefined)?.id
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin'

  const load = useCallback(() => {
    fetch(`/api/tasks/${taskId}/comments`)
      .then(r => r.ok ? r.json() : { comments: [] })
      .then(d => { setComments(d.comments || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [taskId])

  useEffect(() => { load() }, [load])

  const post = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    setPosting(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim() }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setComments(prev => [...prev, data.comment])
      setBody('')
    } catch {
      // silent — toast not available here
    } finally {
      setPosting(false)
    }
  }

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' })
      if (!res.ok) return
      setComments(prev => prev.filter(c => c.id !== id))
    } catch {}
  }

  return (
    <div>
      <p style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        Comments {comments.length > 0 && <span style={{ color: '#8ea8c5' }}>· {comments.length}</span>}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto', marginBottom: 10 }}>
        {loading ? (
          <div style={{ color: '#52749a', fontSize: 12, fontFamily: 'var(--font-system)', textAlign: 'center', padding: 12 }}>Loading…</div>
        ) : comments.length === 0 ? (
          <div style={{ color: '#52749a', fontSize: 12, fontFamily: 'var(--font-system)', textAlign: 'center', padding: 12 }}>No comments yet</div>
        ) : (
          comments.map(c => {
            const canDelete = userId === c.authorId || isAdmin
            return (
              <div key={c.id} style={{ display: 'flex', gap: 8, padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
                <Avatar name={c.authorName} color="#2563eb" size={24} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontFamily: 'var(--font-system)', fontSize: 12, color: '#eef3fa', fontWeight: 600 }}>{c.authorName}</span>
                    <span style={{ fontFamily: 'var(--font-system)', fontSize: 10, color: '#52749a' }}>{relativeTime(c.createdAt)}</span>
                  </div>
                  <p style={{ fontFamily: 'var(--font-system)', fontSize: 12, color: '#eef3fa', marginTop: 2, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{c.body}</p>
                </div>
                {canDelete && (
                  <button
                    onClick={() => remove(c.id)}
                    aria-label="Delete comment"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0.4, display: 'flex', alignSelf: 'flex-start' }}
                  >
                    <IcTrash size={12} color="#ef4444" />
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
      <form onSubmit={post} style={{ display: 'flex', gap: 6 }}>
        <input
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Add a comment…"
          maxLength={2000}
          style={{ flex: 1, background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px', color: '#eef3fa', fontFamily: 'var(--font-system)', fontSize: 13, outline: 'none' }}
        />
        <button
          type="submit"
          disabled={posting || !body.trim()}
          style={{ padding: '8px 14px', borderRadius: 10, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: posting || !body.trim() ? 0.5 : 1 }}
        >
          {posting ? '…' : 'Post'}
        </button>
      </form>
    </div>
  )
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.round(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return `${d}d ago`
}
