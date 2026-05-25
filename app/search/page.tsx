'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Avatar from '@/components/ui/Avatar'
import TabBar from '@/components/ui/TabBar'
import { IcChevL, IcSearch, IcCheck, IcReceipt, IcHardhat, IcPin, IcAlert, IcDoc, IcTeam, IcSpark, IcBell, IcLayers } from '@/components/ui/Icons'

interface SearchResult {
  projects: Array<{ id: string; name: string; status: string; clientName: string; postcode: string; progress: number }>
  tasks: Array<{ id: string; title: string; status: string; priority: string; projectId?: string | null; project?: { name: string } | null; assignee?: { name: string } | null }>
  team: Array<{ id: string; name: string; role: string; avatarColor: string; onSite: boolean }>
  invoices: Array<{ id: string; number: string; clientName: string; amount: number; status: string; projectId?: string | null; project?: { name: string } | null }>
  snags: Array<{ id: string; title: string; status: string; priority: string; project?: { name: string } | null }>
  rfis: Array<{ id: string; number: string; subject: string; status: string; priority: string; project?: { name: string } | null }>
  documents: Array<{ id: string; name: string; type: string; project?: { name: string } | null }>
  customers: Array<{ id: string; name: string; contactName?: string | null; contactEmail?: string | null; postcode?: string | null }>
  subcontractors: Array<{ id: string; name: string; trade?: string | null; contactName?: string | null; cisStatus: string }>
  tags: Array<{ id: string; name: string | null; color: string | null }>
  processDocs: Array<{ id: string; title: string | null; category: string | null; owner: string | null; version: string | null }>
  reminders: Array<{ id: string; title: string | null; dueAt: string | null; done: boolean | null }>
  goals: Array<{ id: string; title: string | null; owner: string | null; quarter: string | null; status: string | null; progress: number | null }>
  improvements: Array<{ id: string; title: string | null; status: string | null; impact: string | null; effort: string | null; raisedBy: string | null }>
  kaizenCards: Array<{ id: string; title: string | null; owner: string | null; status: string | null; boardColumn: string | null }>
  claims: Array<{ id: string; policy: string | null; description: string | null; status: string | null; amountClaimed: number | null }>
  siteReviews: Array<{ id: string; kind: string | null; reviewer: string | null; score: number | null; heldAt: string | null }>
  personas: Array<{ id: string; name: string | null; role: string | null; goals: string | null }>
  serviceCatalogItems: Array<{ id: string; name: string | null; category: string | null; unitPrice: number | null; unit: string | null; active: boolean | null }>
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
  // Monotonic counter to drop stale responses. Without this, the user
  // can type 'a' → 'ab' → 'abc' fast enough that the 'a' response
  // lands AFTER the 'abc' response, and setResults overwrites with
  // wrong-query results.
  const reqIdRef = useRef(0)

  const search = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setResults(null)
      return
    }
    const myReqId = ++reqIdRef.current
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      if (myReqId !== reqIdRef.current) return  // stale response — newer query in flight
      setResults(data)
    } catch {
      if (myReqId === reqIdRef.current) setResults(null)
    } finally {
      if (myReqId === reqIdRef.current) setLoading(false)
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
      <div style={{ padding: '16px 56px 12px 60px', position: 'sticky', top: 0, zIndex: 10, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
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
            placeholder="Search projects, tasks, team, invoices, snags, RFIs, docs…"
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

        {q && results && results.total === 0 && !loading && (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#52749a', fontFamily: 'var(--font-system)' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🔍</div>
            <p style={{ fontSize: 14, color: '#eef3fa' }}>No matches for &ldquo;{q}&rdquo;</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Try a different keyword or a project name.</p>
          </div>
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

        {results && results.snags.length > 0 && (
          <Section title="Snags" count={results.snags.length}>
            {results.snags.map(s => (
              <button key={s.id} onClick={() => router.push('/snags')} style={cardStyle}>
                <IcAlert size={14} color={priorityColor[s.priority] || '#ef4444'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={titleStyle}>{s.title}</div>
                  <div style={subStyle}>{s.project?.name || 'No project'} · {s.status}</div>
                </div>
              </button>
            ))}
          </Section>
        )}

        {results && results.rfis.length > 0 && (
          <Section title="RFIs" count={results.rfis.length}>
            {results.rfis.map(r => (
              <button key={r.id} onClick={() => router.push('/rfis')} style={cardStyle}>
                <IcAlert size={14} color={priorityColor[r.priority] || '#f59e0b'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={titleStyle}>{r.number} — {r.subject}</div>
                  <div style={subStyle}>{r.project?.name || 'No project'} · {r.status}</div>
                </div>
              </button>
            ))}
          </Section>
        )}

        {results && results.documents.length > 0 && (
          <Section title="Documents" count={results.documents.length}>
            {results.documents.map(d => (
              <button key={d.id} onClick={() => router.push('/documents')} style={cardStyle}>
                <IcDoc size={14} color="#06b6d4" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={titleStyle}>{d.name}</div>
                  <div style={subStyle}>{d.type}{d.project ? ` · ${d.project.name}` : ''}</div>
                </div>
              </button>
            ))}
          </Section>
        )}

        {results && results.customers.length > 0 && (
          <Section title="Customers" count={results.customers.length}>
            {results.customers.map(c => (
              <button key={c.id} onClick={() => router.push('/customers')} style={cardStyle}>
                <IcTeam size={14} color="#2563eb" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={titleStyle}>{c.name}</div>
                  <div style={subStyle}>{[c.contactName, c.contactEmail, c.postcode].filter(Boolean).join(' · ') || 'No contact'}</div>
                </div>
              </button>
            ))}
          </Section>
        )}

        {results && results.subcontractors.length > 0 && (
          <Section title="Subcontractors" count={results.subcontractors.length}>
            {results.subcontractors.map(s => (
              <button key={s.id} onClick={() => router.push('/subs')} style={cardStyle}>
                <IcHardhat size={14} color="#8b5cf6" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={titleStyle}>{s.name}</div>
                  <div style={subStyle}>{[s.trade, s.contactName, `CIS ${s.cisStatus}`].filter(Boolean).join(' · ')}</div>
                </div>
              </button>
            ))}
          </Section>
        )}

        {results && results.tags.length > 0 && (
          <Section title="Tags" count={results.tags.length}>
            {results.tags.map(t => (
              <button key={t.id} onClick={() => router.push('/tags')} style={cardStyle}>
                <IcLayers size={14} color={t.color || '#8ea8c5'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={titleStyle}>{t.name || '(unnamed)'}</div>
                </div>
              </button>
            ))}
          </Section>
        )}

        {results && results.processDocs.length > 0 && (
          <Section title="Process docs" count={results.processDocs.length}>
            {results.processDocs.map(p => (
              <button key={p.id} onClick={() => router.push('/process-library')} style={cardStyle}>
                <IcDoc size={14} color="#06b6d4" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={titleStyle}>{p.title || '(untitled)'}</div>
                  <div style={subStyle}>{[p.category, p.owner, p.version].filter(Boolean).join(' · ')}</div>
                </div>
              </button>
            ))}
          </Section>
        )}

        {results && results.reminders.length > 0 && (
          <Section title="Reminders" count={results.reminders.length}>
            {results.reminders.map(r => (
              <button key={r.id} onClick={() => router.push('/reminders')} style={cardStyle}>
                <IcBell size={14} color={r.done ? '#52749a' : '#f59e0b'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...titleStyle, textDecoration: r.done ? 'line-through' : 'none', opacity: r.done ? 0.5 : 1 }}>
                    {r.title || '(untitled)'}
                  </div>
                  {r.dueAt && (
                    <div style={subStyle}>Due {new Date(r.dueAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                  )}
                </div>
              </button>
            ))}
          </Section>
        )}

        {results && results.goals.length > 0 && (
          <Section title="Goals (OKRs)" count={results.goals.length}>
            {results.goals.map(g => (
              <button key={g.id} onClick={() => router.push('/goals')} style={cardStyle}>
                <IcSpark size={14} color="#06b6d4" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={titleStyle}>{g.title || '(untitled)'}</div>
                  <div style={subStyle}>{[g.owner, g.quarter, g.status].filter(Boolean).join(' · ')}</div>
                </div>
                {typeof g.progress === 'number' && (
                  <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#8ea8c5', fontWeight: 700 }}>{g.progress}%</span>
                )}
              </button>
            ))}
          </Section>
        )}

        {results && results.improvements.length > 0 && (
          <Section title="Improvements" count={results.improvements.length}>
            {results.improvements.map(i => (
              <button key={i.id} onClick={() => router.push('/improve-hub')} style={cardStyle}>
                <IcSpark size={14} color="#10b981" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={titleStyle}>{i.title || '(untitled)'}</div>
                  <div style={subStyle}>{[i.raisedBy, i.status, i.impact && `impact ${i.impact}`, i.effort && `effort ${i.effort}`].filter(Boolean).join(' · ')}</div>
                </div>
              </button>
            ))}
          </Section>
        )}

        {results && results.kaizenCards.length > 0 && (
          <Section title="Kaizen cards" count={results.kaizenCards.length}>
            {results.kaizenCards.map(k => (
              <button key={k.id} onClick={() => router.push('/kaizen-board')} style={cardStyle}>
                <IcLayers size={14} color="#f59e0b" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={titleStyle}>{k.title || '(untitled)'}</div>
                  <div style={subStyle}>{[k.owner, k.status, k.boardColumn].filter(Boolean).join(' · ')}</div>
                </div>
              </button>
            ))}
          </Section>
        )}

        {results && results.claims.length > 0 && (
          <Section title="Insurance claims" count={results.claims.length}>
            {results.claims.map(c => (
              <button key={c.id} onClick={() => router.push('/claims')} style={cardStyle}>
                <IcAlert size={14} color="#ef4444" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={titleStyle}>{c.policy || c.description || '(unidentified)'}</div>
                  <div style={subStyle}>{[c.status, c.amountClaimed && `£${c.amountClaimed.toLocaleString()}`].filter(Boolean).join(' · ')}</div>
                </div>
              </button>
            ))}
          </Section>
        )}

        {results && results.siteReviews.length > 0 && (
          <Section title="Site reviews" count={results.siteReviews.length}>
            {results.siteReviews.map(sr => (
              <button key={sr.id} onClick={() => router.push('/reviews')} style={cardStyle}>
                <IcCheck size={14} color="#10b981" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={titleStyle}>{[sr.kind, sr.reviewer].filter(Boolean).join(' · ') || '(unscored)'}</div>
                  {sr.heldAt && <div style={subStyle}>Held {new Date(sr.heldAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}{typeof sr.score === 'number' ? ` · score ${sr.score}` : ''}</div>}
                </div>
              </button>
            ))}
          </Section>
        )}

        {results && results.personas.length > 0 && (
          <Section title="Personas" count={results.personas.length}>
            {results.personas.map(p => (
              <button key={p.id} onClick={() => router.push('/personas')} style={cardStyle}>
                <IcTeam size={14} color="#8b5cf6" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={titleStyle}>{p.name || '(unnamed)'}</div>
                  <div style={subStyle}>{[p.role, p.goals].filter(Boolean).join(' · ')}</div>
                </div>
              </button>
            ))}
          </Section>
        )}

        {results && results.serviceCatalogItems.length > 0 && (
          <Section title="Service catalog" count={results.serviceCatalogItems.length}>
            {results.serviceCatalogItems.map(s => (
              <button key={s.id} onClick={() => router.push('/service-catalog')} style={cardStyle}>
                <IcLayers size={14} color="#06b6d4" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={titleStyle}>{s.name || '(unnamed)'}</div>
                  <div style={subStyle}>{[s.category, typeof s.unitPrice === 'number' && `£${s.unitPrice}${s.unit ? '/' + s.unit : ''}`, s.active === false && 'inactive'].filter(Boolean).join(' · ')}</div>
                </div>
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
