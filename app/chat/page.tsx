'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcBell, IcChevL, IcX } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

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

const SF = 'var(--font-system)'

export default function ChatIndexPage() {
  const [items, setItems] = useState<Conversation[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [showCompose, setShowCompose] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', projectId: '' })
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useModalEffects(showCompose, () => setShowCompose(false))

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations')
      if (!res.ok) throw new Error('Failed to load conversations')
      const d = await res.json()
      setItems(d.items || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    fetch('/api/projects').then(r => r.ok ? r.json() : null).then(d => {
      setProjects((d?.projects || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
    }).catch(() => {})
  }, [load])

  // Poll every 30s when the tab is visible so the list reflects new
  // activity without a hard refresh. Pause when hidden to keep DB load
  // off when nobody is looking.
  useEffect(() => {
    const start = () => {
      if (pollRef.current) return
      pollRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') load()
      }, 30_000)
    }
    const stop = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') { load(); start() }
      else stop()
    }
    document.addEventListener('visibilitychange', onVis)
    start()
    return () => { document.removeEventListener('visibilitychange', onVis); stop() }
  }, [load])

  const create = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          projectId: form.projectId || undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Failed')
      const created = await res.json()
      setItems(prev => [created.item, ...prev])
      setShowCompose(false)
      setForm({ title: '', projectId: '' })
      setToast({ msg: 'Conversation started' })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Create failed', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // Group conversations: project-scoped at top (by project name), then
  // unattached threads. Within each group we keep API order (lastMessageAt
  // DESC, NULLS LAST → createdAt DESC).
  const grouped = (() => {
    const byProject = new Map<string, { project: Project | null; rows: Conversation[] }>()
    const orphans: Conversation[] = []
    for (const c of items) {
      if (c.archivedAt) continue
      if (c.project?.id) {
        const k = c.project.id
        if (!byProject.has(k)) byProject.set(k, { project: c.project!, rows: [] })
        byProject.get(k)!.rows.push(c)
      } else {
        orphans.push(c)
      }
    }
    return { byProject: Array.from(byProject.values()), orphans }
  })()

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      <div style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: SF, fontSize: 13, color: '#52749a' }}>Apps</span>
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Team chat</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {items.filter(i => !i.archivedAt).length} active conversation{items.filter(i => !i.archivedAt).length === 1 ? '' : 's'}
            </p>
          </div>
          <button onClick={() => setShowCompose(true)} aria-label="New conversation" style={{ padding: '8px 14px', borderRadius: 10, background: '#06b6d4', border: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            + New
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: SF, fontSize: 14 }}>{error}</div>
      ) : grouped.byProject.length === 0 && grouped.orphans.length === 0 ? (
        <div style={{ padding: '60px 40px', textAlign: 'center', color: '#52749a', fontFamily: SF }}>
          <IcBell size={32} color="#52749a" />
          <p style={{ marginTop: 12, fontSize: 14 }}>No conversations yet</p>
          <button onClick={() => setShowCompose(true)} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#06b6d4', border: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Start one
          </button>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {grouped.byProject.map(g => (
            <div key={g.project?.id || 'p'} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 4 }}>
                {g.project?.name || 'Project'}
              </div>
              {g.rows.map(c => <Row key={c.id} c={c} />)}
            </div>
          ))}
          {grouped.orphans.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 4 }}>
                Other threads
              </div>
              {grouped.orphans.map(c => <Row key={c.id} c={c} />)}
            </div>
          )}
        </div>
      )}

      <TabBar />

      {showCompose && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowCompose(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.3, fontFamily: SF }}>New conversation</h2>
              <button onClick={() => setShowCompose(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>

            <div>
              <label style={labelStyle}>Project (optional)</label>
              <select value={form.projectId} onChange={e => setForm(p => ({ ...p, projectId: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                <option value="">— Workspace-wide —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Title</label>
              <input autoFocus value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="What's this thread about?" style={inputStyle} />
            </div>

            <button onClick={create} disabled={saving || !form.title.trim()} style={{ marginTop: 4, padding: '14px 0', borderRadius: 14, background: '#06b6d4', border: 'none', color: '#fff', fontFamily: SF, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.title.trim() ? 0.5 : 1 }}>
              {saving ? 'Creating…' : 'Start chat'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ c }: { c: Conversation }) {
  const stamp = c.lastMessageAt || c.createdAt
  const ago = relativeTime(new Date(stamp))
  return (
    <Link href={`/chat/${c.id}`} style={{ textDecoration: 'none' }}>
      <div style={{ background: '#152641', borderRadius: 12, padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: '#eef3fa', letterSpacing: -0.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</div>
          <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', marginTop: 2 }}>
            {c.lastMessageAt ? `Active ${ago}` : `Created ${ago}`}
          </div>
        </div>
        <span style={{ fontFamily: SF, fontSize: 10, color: '#06b6d4', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, padding: '3px 8px', borderRadius: 99, background: 'rgba(6,182,212,0.12)', border: '0.5px solid rgba(6,182,212,0.3)' }}>
          {c.kind}
        </span>
      </div>
    </Link>
  )
}

function relativeTime(d: Date): string {
  const diffMs = Date.now() - d.getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const labelStyle: React.CSSProperties = {
  fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#eef3fa', fontFamily: SF, fontSize: 14, outline: 'none', boxSizing: 'border-box',
}
