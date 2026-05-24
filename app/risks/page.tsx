'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcAlert, IcChevL, IcPlus, IcX, IcTrash } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Risk {
  id: string
  projectId: string
  title: string
  category: 'operational' | 'financial' | 'schedule' | 'safety' | 'quality' | 'environmental'
  likelihood: number
  impact: number
  score: number
  mitigation: string | null
  owner: string | null
  status: 'open' | 'mitigated' | 'accepted' | 'closed'
  reviewBy: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  project?: { id: string; name: string } | null
}
interface Project { id: string; name: string }

const CATEGORY_LABEL: Record<Risk['category'], string> = {
  operational: 'Operational', financial: 'Financial', schedule: 'Schedule', safety: 'Safety', quality: 'Quality', environmental: 'Environmental',
}
const STATUS_COLOR: Record<Risk['status'], string> = {
  open: '#ef4444', mitigated: '#f59e0b', accepted: '#06b6d4', closed: '#10b981',
}
const SF = 'var(--font-system)'

// Risk colour by score (1-25). Standard 5x5 risk matrix mapping.
function riskColor(score: number): string {
  if (score >= 15) return '#ef4444' // red — high
  if (score >= 8) return '#f59e0b'  // amber — medium
  return '#10b981'                  // green — low
}
function riskLabel(score: number): string {
  if (score >= 15) return 'HIGH'
  if (score >= 8) return 'MEDIUM'
  return 'LOW'
}

export default function RisksPage() {
  const [risks, setRisks] = useState<Risk[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | Risk['status']>('all')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const [form, setForm] = useState({
    projectId: '', title: '', category: 'operational' as Risk['category'],
    likelihood: 3, impact: 3, mitigation: '', owner: '', reviewBy: '',
  })

  useModalEffects(showModal, () => setShowModal(false))

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const [rRes, prjRes] = await Promise.all([
        fetch(`/api/risks?${params.toString()}`),
        fetch('/api/projects?status=active'),
      ])
      if (!rRes.ok) throw new Error('Failed to load risks')
      const rd = await rRes.json()
      setRisks(rd.risks || [])
      if (prjRes.ok) {
        const pd = await prjRes.json()
        setProjects((pd.projects || []).map((p: Project) => ({ id: p.id, name: p.name })))
      }
      setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unknown error') }
    finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const matrix = useMemo(() => {
    // 5x5 grid: rows = impact (5→1 top to bottom), cols = likelihood (1→5)
    const cells = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0))
    for (const r of risks) {
      if (r.status === 'closed') continue
      const row = 5 - r.impact // 1..5 with 5 at top
      const col = r.likelihood - 1
      if (row >= 0 && row < 5 && col >= 0 && col < 5) cells[row][col]++
    }
    return cells
  }, [risks])

  const openAdd = () => {
    setForm({ projectId: projects[0]?.id || '', title: '', category: 'operational', likelihood: 3, impact: 3, mitigation: '', owner: '', reviewBy: '' })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.title.trim()) return setToast({ msg: 'Title is required', type: 'error' })
    if (!form.projectId) return setToast({ msg: 'Pick a project', type: 'error' })
    setSaving(true)
    try {
      const res = await fetch('/api/risks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setToast({ msg: 'Risk logged', type: 'success' })
      setShowModal(false); load()
    } catch (e) { setToast({ msg: e instanceof Error ? e.message : 'Save failed', type: 'error' }) }
    finally { setSaving(false) }
  }

  const setStatus = async (r: Risk, status: Risk['status']) => {
    try {
      const res = await fetch(`/api/risks/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      if (!res.ok) throw new Error()
      load()
    } catch { setToast({ msg: 'Update failed', type: 'error' }) }
  }

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/risks/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setConfirmDelete(null); load()
    } catch { setToast({ msg: 'Delete failed', type: 'error' }) }
  }

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      <div style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: SF, fontSize: 13, color: '#52749a' }}>Apps</span>
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF, display: 'flex', alignItems: 'center', gap: 8 }}>
              <IcAlert size={20} color="#ef4444" /> Risk register
            </h1>
            <p style={{ fontSize: 11, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {risks.filter(r => r.status === 'open').length} open · {risks.filter(r => r.score >= 15 && r.status !== 'closed').length} high
            </p>
          </div>
          <button onClick={openAdd} aria-label="Add risk" style={{ background: '#ef4444', border: 'none', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <IcPlus size={14} color="#fff" />
            <span style={{ fontFamily: SF, fontSize: 13, color: '#fff', fontWeight: 600 }}>Log</span>
          </button>
        </div>
      </div>

      {/* 5x5 risk matrix */}
      <div style={{ padding: '16px', overflowX: 'auto' }}>
        <div style={{ fontFamily: SF, fontSize: 10, color: '#8ea8c5', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>5 × 5 matrix (open + mitigated + accepted)</div>
        <div style={{ display: 'inline-grid', gridTemplateColumns: '32px repeat(5, 48px)', gap: 4 }}>
          <div />
          {[1, 2, 3, 4, 5].map(l => (
            <div key={l} style={{ textAlign: 'center', fontFamily: SF, fontSize: 10, color: '#52749a', fontWeight: 700 }}>L{l}</div>
          ))}
          {[5, 4, 3, 2, 1].map((impact, rowIdx) => (
            <>
              <div key={`label-${impact}`} style={{ textAlign: 'right', alignSelf: 'center', fontFamily: SF, fontSize: 10, color: '#52749a', fontWeight: 700, paddingRight: 4 }}>I{impact}</div>
              {[1, 2, 3, 4, 5].map(likelihood => {
                const score = likelihood * impact
                const count = matrix[rowIdx][likelihood - 1]
                const color = riskColor(score)
                return (
                  <div key={`${impact}-${likelihood}`} style={{ background: color + (count > 0 ? '99' : '22'), border: `0.5px solid ${color}66`, borderRadius: 6, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SF, fontSize: 11, color: count > 0 ? '#fff' : '#52749a', fontWeight: 700 }}>
                    {count > 0 ? count : score}
                  </div>
                )
              })}
            </>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {(['all', 'open', 'mitigated', 'accepted', 'closed'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{ background: statusFilter === s ? '#ef4444' : '#152641', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '6px 12px', cursor: 'pointer', fontFamily: SF, fontSize: 12, color: statusFilter === s ? '#fff' : '#c1d2e8', fontWeight: 600, flexShrink: 0, textTransform: 'capitalize' }}>
            {s}
          </button>
        ))}
      </div>

      {loading && <div style={{ padding: 24, color: '#8ea8c5', fontFamily: SF, fontSize: 13 }}>Loading…</div>}
      {error && <div style={{ padding: 24, color: '#fca5a5', fontFamily: SF, fontSize: 13 }}>{error}</div>}
      {!loading && risks.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>No risks logged yet.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px' }}>
        {risks.map(r => {
          const color = riskColor(r.score)
          return (
            <div key={r.id} style={{ background: '#152641', border: `0.5px solid ${color}33`, borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ background: '#1a2f4e', color: '#c1d2e8', padding: '2px 8px', borderRadius: 6, fontFamily: SF, fontSize: 10, fontWeight: 700 }}>{CATEGORY_LABEL[r.category]}</span>
                    <span style={{ background: color + '33', color, padding: '2px 8px', borderRadius: 6, fontFamily: SF, fontSize: 10, fontWeight: 700 }}>{riskLabel(r.score)} · {r.score}</span>
                    <span style={{ background: STATUS_COLOR[r.status] + '33', color: STATUS_COLOR[r.status], padding: '2px 8px', borderRadius: 6, fontFamily: SF, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{r.status}</span>
                  </div>
                  <div style={{ fontFamily: SF, fontSize: 14, color: '#eef3fa', fontWeight: 600 }}>{r.title}</div>
                  <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', marginTop: 2 }}>
                    {r.project?.name || '—'} · Likelihood {r.likelihood}/5 × Impact {r.impact}/5{r.owner ? ` · ${r.owner}` : ''}
                  </div>
                  {r.mitigation && (
                    <div style={{ marginTop: 8, padding: 8, background: '#0a1426', borderRadius: 6, fontFamily: SF, fontSize: 12, color: '#c1d2e8', whiteSpace: 'pre-wrap' }}>
                      <div style={{ fontFamily: SF, fontSize: 10, color: '#8ea8c5', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Mitigation</div>
                      {r.mitigation}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {r.status === 'open' && <button onClick={() => setStatus(r, 'mitigated')} style={pillBtn('#f59e0b')}>Mitigate</button>}
                {r.status === 'open' && <button onClick={() => setStatus(r, 'accepted')} style={pillBtn('#06b6d4')}>Accept</button>}
                {r.status !== 'closed' && <button onClick={() => setStatus(r, 'closed')} style={pillBtn('#10b981')}>Close</button>}
                {r.status === 'closed' && <button onClick={() => setStatus(r, 'open')} style={pillBtn('#1a2f4e', '#c1d2e8')}>Reopen</button>}
                <button onClick={() => setConfirmDelete(r.id)} aria-label="Delete" style={pillBtn('transparent', '#fca5a5', '#ef444466')}>
                  <IcTrash size={11} color="#fca5a5" /> Delete
                </button>
              </div>
              {confirmDelete === r.id && (
                <div style={{ marginTop: 10, padding: 10, background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.4)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontFamily: SF, fontSize: 12, color: '#fca5a5' }}>Delete this risk?</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setConfirmDelete(null)} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '4px 10px', color: '#c1d2e8', fontFamily: SF, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={() => remove(r.id)} style={{ background: '#ef4444', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#fff', fontFamily: SF, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0a1426', width: '100%', maxHeight: '90vh', borderRadius: '20px 20px 0 0', padding: 20, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: SF, fontSize: 18, fontWeight: 700, color: '#eef3fa' }}>Log risk</h2>
              <button onClick={() => setShowModal(false)} aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <IcX size={18} color="#52749a" />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Project *">
                <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} style={inputStyle}>
                  <option value="">Select…</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Title *">
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} placeholder="Steel delivery delayed by 4 weeks" />
              </Field>
              <Field label="Category">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(Object.keys(CATEGORY_LABEL) as Risk['category'][]).map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, category: c }))} style={{ background: form.category === c ? '#ef4444' : '#152641', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: form.category === c ? '#fff' : '#c1d2e8', fontFamily: SF, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      {CATEGORY_LABEL[c]}
                    </button>
                  ))}
                </div>
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label={`Likelihood: ${form.likelihood} / 5`}>
                  <input type="range" min="1" max="5" value={form.likelihood} onChange={e => setForm(f => ({ ...f, likelihood: Number(e.target.value) }))} style={{ width: '100%' }} />
                </Field>
                <Field label={`Impact: ${form.impact} / 5`}>
                  <input type="range" min="1" max="5" value={form.impact} onChange={e => setForm(f => ({ ...f, impact: Number(e.target.value) }))} style={{ width: '100%' }} />
                </Field>
              </div>
              <div style={{ padding: 10, background: riskColor(form.likelihood * form.impact) + '22', border: `0.5px solid ${riskColor(form.likelihood * form.impact)}66`, borderRadius: 8, textAlign: 'center', fontFamily: SF, fontSize: 14, color: riskColor(form.likelihood * form.impact), fontWeight: 700 }}>
                Score {form.likelihood * form.impact} — {riskLabel(form.likelihood * form.impact)}
              </div>
              <Field label="Owner">
                <input type="text" value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} style={inputStyle} placeholder="Project manager" />
              </Field>
              <Field label="Mitigation">
                <textarea value={form.mitigation} onChange={e => setForm(f => ({ ...f, mitigation: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} placeholder="Alternative supplier identified, deposit paid…" />
              </Field>
              <Field label="Review by">
                <input type="date" value={form.reviewBy} onChange={e => setForm(f => ({ ...f, reviewBy: e.target.value }))} style={inputStyle} />
              </Field>
              <button onClick={save} disabled={saving} style={{ background: '#ef4444', border: 'none', borderRadius: 10, padding: 12, color: '#fff', fontFamily: SF, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Log risk'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <TabBar />
    </div>
  )
}

const inputStyle = { background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', color: '#eef3fa', fontFamily: SF, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const }
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={{ display: 'block', fontFamily: SF, fontSize: 11, color: '#8ea8c5', fontWeight: 600, marginBottom: 4 }}>{label}</label>{children}</div>
}
function pillBtn(bg: string, color = '#fff', borderColor = 'rgba(255,255,255,0.1)'): React.CSSProperties {
  return { background: bg, border: `0.5px solid ${borderColor}`, borderRadius: 8, padding: '6px 10px', color, fontFamily: SF, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }
}
