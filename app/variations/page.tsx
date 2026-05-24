'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcWrench, IcChevL, IcPlus, IcX, IcCheck, IcTrash, IcSend, IcPound, IcClock } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Project { id: string; name: string; budget: number; clientName: string }
interface Variation {
  id: string
  number: string
  projectId: string
  title: string
  description: string | null
  costImpact: number
  daysImpact: number
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  clientName: string | null
  notes: string | null
  submittedAt: string | null
  approvedAt: string | null
  rejectedAt: string | null
  createdAt: string
  project?: Project | null
}
interface ApprovedTotals { costImpact: number; daysImpact: number }

const SF = 'var(--font-system)'

const STATUS_COLOR: Record<Variation['status'], string> = {
  draft: '#52749a',
  submitted: '#f59e0b',
  approved: '#22c55e',
  rejected: '#ef4444',
}
const STATUS_LABEL: Record<Variation['status'], string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
}

export default function VariationsPage() {
  const [variations, setVariations] = useState<Variation[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [approvedTotals, setApprovedTotals] = useState<ApprovedTotals>({ costImpact: 0, daysImpact: 0 })
  const [projects, setProjects] = useState<Project[]>([])
  const [filter, setFilter] = useState<'all' | Variation['status']>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [activeVar, setActiveVar] = useState<Variation | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    projectId: '',
    costImpact: '',
    daysImpact: '',
    clientName: '',
  })

  useModalEffects(showAdd || activeVar !== null, () => { setShowAdd(false); setActiveVar(null) })

  const load = useCallback(() => {
    fetch('/api/variations')
      .then(r => { if (!r.ok) throw new Error('Failed to load variations'); return r.json() })
      .then(d => { setVariations(d.variations || []); setPendingCount(d.pendingCount || 0); setApprovedTotals(d.approvedTotals || { costImpact: 0, daysImpact: 0 }); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
    fetch('/api/projects').then(r => r.ok ? r.json() : null).then(d => {
      const ps: Project[] = (d?.projects || []).map((p: { id: string; name: string; budget: number; clientName: string }) => ({ id: p.id, name: p.name, budget: p.budget, clientName: p.clientName }))
      setProjects(ps)
      setForm(prev => prev.projectId ? prev : { ...prev, projectId: ps[0]?.id || '', clientName: prev.clientName || ps[0]?.clientName || '' })
    }).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.title.trim() || !form.projectId) return
    setSaving(true)
    try {
      const res = await fetch('/api/variations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          projectId: form.projectId,
          costImpact: form.costImpact === '' ? 0 : Number(form.costImpact),
          daysImpact: form.daysImpact === '' ? 0 : parseInt(form.daysImpact),
          clientName: form.clientName.trim() || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Failed')
      setShowAdd(false)
      setForm(prev => ({ ...prev, title: '', description: '', costImpact: '', daysImpact: '' }))
      load()
      setToast({ msg: 'Variation drafted' })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (v: Variation, next: Variation['status']) => {
    try {
      const res = await fetch(`/api/variations/${v.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error('Failed')
      const updated = await res.json()
      if (activeVar?.id === v.id) setActiveVar(updated)
      load()
    } catch {
      setToast({ msg: 'Status change failed', type: 'error' })
    }
  }

  const remove = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete(curr => curr === id ? null : curr), 3000)
      return
    }
    setConfirmDelete(null)
    try {
      const res = await fetch(`/api/variations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setActiveVar(null)
      load()
    } catch {
      setToast({ msg: 'Delete failed', type: 'error' })
    }
  }

  const sendForApproval = (v: Variation) => {
    const subject = `Variation ${v.number} for approval — ${v.title}`
    const body = `Hi${v.clientName ? ` ${v.clientName}` : ''},\n\nPlease find variation ${v.number} for your review and approval.\n\nProject: ${v.project?.name || 'Project'}\nTitle: ${v.title}\n${v.description ? `\nDescription:\n${v.description}\n` : ''}\nCost impact: £${v.costImpact.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nTime impact: ${v.daysImpact} day${v.daysImpact === 1 ? '' : 's'}\n\nKind regards,\nCortexx`
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_self')
  }

  const filtered = filter === 'all' ? variations : variations.filter(v => v.status === filter)

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      <div style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: SF, fontSize: 13, color: '#52749a' }}>Apps</span>
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Variations</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {variations.length} total · {pendingCount} pending
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} aria-label="Draft variation" disabled={projects.length === 0} style={{ width: 36, height: 36, borderRadius: 10, background: projects.length === 0 ? 'rgba(139,92,246,0.3)' : '#8b5cf6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: projects.length === 0 ? 'not-allowed' : 'pointer' }}>
            <IcPlus size={18} color="#fff" />
          </button>
        </div>

        {(approvedTotals.costImpact !== 0 || approvedTotals.daysImpact !== 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '0.5px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '8px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: SF, fontSize: 10, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                <IcPound size={11} color="#22c55e" /> Approved cost
              </div>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 16, color: approvedTotals.costImpact >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700, marginTop: 2 }}>
                {approvedTotals.costImpact >= 0 ? '+' : ''}£{approvedTotals.costImpact.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '0.5px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '8px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: SF, fontSize: 10, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                <IcClock size={11} color="#22c55e" /> Approved days
              </div>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 16, color: approvedTotals.daysImpact >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700, marginTop: 2 }}>
                {approvedTotals.daysImpact >= 0 ? '+' : ''}{approvedTotals.daysImpact}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {(['all', 'draft', 'submitted', 'approved', 'rejected'] as const).map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 99, border: 'none', background: filter === t ? '#8b5cf6' : 'rgba(255,255,255,0.06)', color: filter === t ? '#fff' : '#52749a', fontFamily: SF, fontSize: 12, fontWeight: filter === t ? 700 : 400, cursor: 'pointer' }}>
              {t === 'all' ? 'All' : STATUS_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: SF, fontSize: 14 }}>{error}</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '60px 40px', textAlign: 'center', color: '#52749a', fontFamily: SF }}>
          <IcWrench size={32} color="#52749a" />
          <p style={{ marginTop: 12, fontSize: 14 }}>{variations.length === 0 ? 'No variations yet' : 'Nothing in this filter'}</p>
          {variations.length === 0 && projects.length > 0 && (
            <button onClick={() => setShowAdd(true)} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#8b5cf6', border: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Draft first variation
            </button>
          )}
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(v => (
            <button key={v.id} onClick={() => setActiveVar(v)} style={{ background: '#152641', borderRadius: 14, padding: '14px', border: '0.5px solid rgba(255,255,255,0.07)', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 700, color: '#52749a', letterSpacing: 0.5 }}>{v.number}</span>
                {v.project && <span style={{ fontFamily: SF, fontSize: 11, color: '#52749a' }}>{v.project.name}</span>}
                <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 99, background: `${STATUS_COLOR[v.status]}22`, color: STATUS_COLOR[v.status], fontFamily: SF, fontSize: 9, fontWeight: 700, border: `1px solid ${STATUS_COLOR[v.status]}55`, textTransform: 'uppercase', letterSpacing: 0.5 }}>{STATUS_LABEL[v.status]}</span>
              </div>
              <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: '#eef3fa' }}>{v.title}</div>
              <div style={{ display: 'flex', gap: 12, fontFamily: SF, fontSize: 11, color: '#8ea8c5' }}>
                <span style={{ fontFamily: 'ui-monospace, monospace', color: v.costImpact >= 0 ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
                  {v.costImpact >= 0 ? '+' : ''}£{v.costImpact.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                </span>
                <span style={{ fontFamily: 'ui-monospace, monospace', color: v.daysImpact >= 0 ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
                  {v.daysImpact >= 0 ? '+' : ''}{v.daysImpact}d
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <TabBar />

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowAdd(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.3, fontFamily: SF }}>Draft variation</h2>
              <button onClick={() => setShowAdd(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>

            <input autoFocus value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="What changed scope?" style={inputStyle} />
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Detail of the change" rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: SF }} />

            <div>
              <label style={labelStyle}>Project</label>
              <select value={form.projectId} onChange={e => {
                const projectId = e.target.value
                const p = projects.find(pr => pr.id === projectId)
                setForm(prev => ({ ...prev, projectId, clientName: prev.clientName || p?.clientName || '' }))
              }} style={{ ...inputStyle, appearance: 'none' }}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Cost impact (£)</label>
                <input type="number" step="0.01" value={form.costImpact} onChange={e => setForm(p => ({ ...p, costImpact: e.target.value }))} placeholder="0" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Days impact</label>
                <input type="number" step="1" value={form.daysImpact} onChange={e => setForm(p => ({ ...p, daysImpact: e.target.value }))} placeholder="0" style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Client name (for approval email)</label>
              <input value={form.clientName} onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))} placeholder="Client" style={inputStyle} />
            </div>

            <button onClick={create} disabled={saving || !form.title.trim() || !form.projectId} style={{ marginTop: 4, padding: '14px 0', borderRadius: 14, background: '#8b5cf6', border: 'none', color: '#fff', fontFamily: SF, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.title.trim() || !form.projectId ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? 'Saving…' : <><IcCheck size={16} color="#fff" /> Save as draft</>}
            </button>
          </div>
        </div>
      )}

      {activeVar && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setActiveVar(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#52749a', fontWeight: 700, letterSpacing: 0.5 }}>{activeVar.number}</div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.3, fontFamily: SF, marginTop: 2 }}>{activeVar.title}</h2>
              </div>
              <button onClick={() => setActiveVar(null)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: '#1a2f4e', padding: '10px 12px', borderRadius: 10 }}>
                <div style={{ ...labelStyle, marginBottom: 4 }}>Cost impact</div>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 20, color: activeVar.costImpact >= 0 ? '#f59e0b' : '#10b981', fontWeight: 700 }}>
                  {activeVar.costImpact >= 0 ? '+' : ''}£{activeVar.costImpact.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ background: '#1a2f4e', padding: '10px 12px', borderRadius: 10 }}>
                <div style={{ ...labelStyle, marginBottom: 4 }}>Time impact</div>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 20, color: activeVar.daysImpact >= 0 ? '#f59e0b' : '#10b981', fontWeight: 700 }}>
                  {activeVar.daysImpact >= 0 ? '+' : ''}{activeVar.daysImpact} day{activeVar.daysImpact === 1 ? '' : 's'}
                </div>
              </div>
            </div>

            {activeVar.description && (
              <div style={{ background: '#1a2f4e', padding: '10px 12px', borderRadius: 10 }}>
                <div style={{ ...labelStyle, marginBottom: 4 }}>Description</div>
                <div style={{ fontFamily: SF, fontSize: 13, color: '#eef3fa', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{activeVar.description}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ padding: '3px 9px', borderRadius: 99, background: `${STATUS_COLOR[activeVar.status]}22`, color: STATUS_COLOR[activeVar.status], fontFamily: SF, fontSize: 10, fontWeight: 700, border: `1px solid ${STATUS_COLOR[activeVar.status]}55`, textTransform: 'uppercase', letterSpacing: 0.5 }}>{STATUS_LABEL[activeVar.status]}</span>
              {activeVar.project && <span style={{ padding: '3px 9px', borderRadius: 99, background: 'rgba(255,255,255,0.06)', color: '#8ea8c5', fontFamily: SF, fontSize: 10 }}>{activeVar.project.name}</span>}
              {activeVar.clientName && <span style={{ padding: '3px 9px', borderRadius: 99, background: 'rgba(255,255,255,0.06)', color: '#8ea8c5', fontFamily: SF, fontSize: 10 }}>→ {activeVar.clientName}</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {activeVar.status === 'draft' && (
                <button onClick={() => changeStatus(activeVar, 'submitted')} style={statusBtn('#f59e0b')}>Submit for approval</button>
              )}
              {activeVar.status === 'submitted' && (
                <>
                  <button onClick={() => changeStatus(activeVar, 'approved')} style={statusBtn('#22c55e')}>Mark approved</button>
                  <button onClick={() => changeStatus(activeVar, 'rejected')} style={statusBtn('#ef4444')}>Mark rejected</button>
                </>
              )}
              {(activeVar.status === 'approved' || activeVar.status === 'rejected') && (
                <button onClick={() => changeStatus(activeVar, 'submitted')} style={statusBtn('#52749a')}>Reopen as submitted</button>
              )}
              <button onClick={() => sendForApproval(activeVar)} style={{ ...statusBtn('#8b5cf6'), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <IcSend size={12} color="#fff" /> Email for approval
              </button>
            </div>

            <button onClick={() => remove(activeVar.id)} style={{ padding: '10px', borderRadius: 10, background: confirmDelete === activeVar.id ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${confirmDelete === activeVar.id ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)'}`, color: '#ef4444', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <IcTrash size={12} color="#ef4444" />
              {confirmDelete === activeVar.id ? 'Sure?' : 'Delete variation'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const statusBtn = (color: string): React.CSSProperties => ({
  padding: '10px', borderRadius: 10, background: `${color}22`, border: `0.5px solid ${color}66`, color, fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer',
})
const labelStyle: React.CSSProperties = {
  fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#eef3fa', fontFamily: SF, fontSize: 14, outline: 'none', boxSizing: 'border-box',
}
