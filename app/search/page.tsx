'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Avatar from '@/components/ui/Avatar'
import TabBar from '@/components/ui/TabBar'
import { IcChevL, IcSearch, IcCheck, IcReceipt, IcHardhat, IcPin } from '@/components/ui/Icons'

interface SearchResult {
  projects: Array<{ id: string; name: string; status: string; clientName: string; postcode: string; progress: number }>
  tasks: Array<{ id: string; title: string; status: string; priority: string; projectId?: string | null; project?: { name: string } | null; assignee?: { name: string } | null }>
  team: Array<{ id: string; name: string; role: string; avatarColor: string; onSite: boolean }>
  invoices: Array<{ id: string; number: string; clientName: string; amount: number; status: string; projectId?: string | null; project?: { name: string } | null }>
  total: number
}

const statusColor: Record<string, string> = { active: '#10b981', snagging: '#f59e0b', quoting: '#8b5cf6', complete: '#52749a' }
const priorityColor: Record<string, string> = { critical: '#ef4444', high: '#f59e0b', medium: '#2563eb', low: '#52749a' }
const invStatusColor: Record<string, string> = { draft: '#52749a', sent: '#f59e0b', paid: '#10b981', overdue: '#ef4444' }

export default function SearchPage() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const search = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setResults(null)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      setResults(data)
    } catch {
      setResults(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [q, search])

  useEffect(() => { inputRef.current?.focus() }, [])

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', position: 'sticky', top: 0, zIndex: 10, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>Back</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#152641', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px' }}>
          <IcSearch size={18} color="#52749a" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search projects, tasks, team, invoices…"
            style={{ background: 'none', border: 'none', outline: 'none', color: '#eef3fa', fontFamily: 'var(--font-system)', fontSize: 15, flex: 1 }}
          />
          {loading && <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #52749a', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />}
        </div>
        {results && (
          <p style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', marginTop: 8 }}>
            {results.total === 0 ? 'No matches' : `${results.total} match${results.total === 1 ? '' : 'es'}`}
          </p>
        )}
      </div>

      <div style={{ padding: '16px 20px' }}>
        {!q && (
          <p style={{ padding: '40px 0', textAlign: 'center', color: '#52749a', fontFamily: 'var(--font-system)', fontSize: 14 }}>
            Type at least 2 characters to search across the workspace.
          </p>
        )}

        {results && results.projects.length > 0 && (
          <Section title="Projects" count={results.projects.length}>
            {results.projects.map(p => (
              <button key={p.id} onClick={() => router.push(`/projects/${p.id}`)} style={cardStyle}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: statusColor[p.status] || '#52749a' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={titleStyle}>{p.name}</div>
                  <div style={subStyle}>{p.clientName}{p.postcode ? ` · ${p.postcode}` : ''}</div>
                </div>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#8ea8c5', fontWeight: 700 }}>{p.progress}%</span>
              </button>
            ))}
          </Section>
        )}

        {results && results.tasks.length > 0 && (
          <Section title="Tasks" count={results.tasks.length}>
            {results.tasks.map(t => (
              <button key={t.id} onClick={() => router.push('/tasks')} style={cardStyle}>
                <IcCheck size={14} color={priorityColor[t.priority] || '#52749a'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...titleStyle, textDecoration: t.status === 'done' ? 'line-through' : 'none', opacity: t.status === 'done' ? 0.5 : 1 }}>{t.title}</div>
                  <div style={subStyle}>{t.project?.name || 'No project'}{t.assignee ? ` · ${t.assignee.name}` : ''}</div>
                </div>
              </button>
            ))}
          </Section>
        )}

        {results && results.team.length > 0 && (
          <Section title="Team" count={results.team.length}>
            {results.team.map(m => (
              <button key={m.id} onClick={() => router.push('/team')} style={cardStyle}>
                <Avatar name={m.name} color={m.avatarColor} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={titleStyle}>{m.name}</div>
                  <div style={subStyle}>{m.role}{m.onSite ? ' · On site' : ''}</div>
                </div>
                {m.onSite && <IcPin size={12} color="#10b981" />}
              </button>
            ))}
          </Section>
        )}

        {results && results.invoices.length > 0 && (
          <Section title="Invoices" count={results.invoices.length}>
            {results.invoices.map(i => (
              <button key={i.id} onClick={() => router.push(i.projectId ? `/projects/${i.projectId}` : '/projects')} style={cardStyle}>
                <IcReceipt size={14} color={invStatusColor[i.status] || '#52749a'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={titleStyle}>{i.number}</div>
                  <div style={subStyle}>{i.clientName}{i.project ? ` · ${i.project.name}` : ''}</div>
                </div>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#eef3fa', fontWeight: 700 }}>£{i.amount.toLocaleString()}</span>
              </button>
            ))}
          </Section>
        )}
      </div>

      <TabBar />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 16 }}>
      <p style={{ fontFamily: 'var(--font-system)', fontSize: 11, fontWeight: 700, color: '#52749a', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
        {title} <span style={{ color: '#8ea8c5' }}>· {count}</span>
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </section>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#152641',
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderRadius: 12,
  padding: '12px 14px',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  cursor: 'pointer',
  textAlign: 'left',
}
const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-system)',
  fontSize: 14,
  color: '#eef3fa',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}
const subStyle: React.CSSProperties = {
  fontFamily: 'var(--font-system)',
  fontSize: 12,
  color: '#8ea8c5',
  marginTop: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}
