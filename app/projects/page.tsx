'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Avatar from '@/components/ui/Avatar'
import { IcSearch, IcPlus, IcChevR, IcX } from '@/components/ui/Icons'
import Toast from '@/components/ui/Toast'
import { useModalEffects } from '@/lib/useModalEffects'
import { broadcastInvalidate, subscribe } from '@/lib/broadcast'
import type { Project } from '@/lib/types'

const statusColor: Record<string, string> = {
  active: '#10b981', snagging: '#f59e0b', quoting: '#8b5cf6', complete: 'var(--t3)',
}
const statusLabel: Record<string, string> = {
  active: 'Active', snagging: 'Snagging', quoting: 'Quoting', complete: 'Complete',
}

const STATUSES = ['active', 'quoting', 'snagging', 'complete']

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [canCreateProject, setCanCreateProject] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [form, setForm] = useState({
    name: '', clientName: '', address: '', postcode: '',
    status: 'active', budget: '', startDate: '', endDate: '',
  })

  useModalEffects(showModal, () => setShowModal(false))

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showArchived, setShowArchived] = useState(false)

  const load = (includeArchived = false) => {
    const url = includeArchived ? '/api/projects?include=only-archived' : '/api/projects'
    fetch(url)
      .then(r => { if (!r.ok) throw new Error('Failed to load projects'); return r.json() })
      .then(d => { setProjects(d.projects || d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  useEffect(() => { load(showArchived) }, [showArchived])

  useEffect(() => {
    fetch('/api/orgs')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const active = d?.organizations?.find((o: { active?: boolean }) => o.active) || d?.organizations?.[0]
        setCanCreateProject(active?.role === 'owner' || active?.role === 'admin')
      })
      .catch(() => setCanCreateProject(false))
  }, [])

  // Cross-tab sync — refetch when another tab broadcasts a projects change.
  useEffect(() => {
    return subscribe(msg => {
      if (msg.type === 'data:invalidate' && (msg.scope === 'projects' || msg.scope === 'all')) {
        load(showArchived)
      }
    })
  }, [showArchived])

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new') === '1' && canCreateProject) {
      setShowModal(true)
    }
  }, [canCreateProject])

  const filtered = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.clientName?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (p.postcode?.toLowerCase() || '').includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    active: projects.filter(p => p.status === 'active').length,
    snagging: projects.filter(p => p.status === 'snagging').length,
    quoting: projects.filter(p => p.status === 'quoting').length,
  }

  const createProject = async () => {
    if (!form.name.trim()) return
    if (form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate)) {
      setToast({ msg: 'End date must be after start date', type: 'error' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          clientName: form.clientName.trim(),
          address: form.address.trim(),
          postcode: form.postcode.trim(),
          status: form.status,
          budget: parseFloat(form.budget) || 0,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          progress: 0,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || 'Failed to create project')
      const newProject = payload
      setProjects(prev => [newProject, ...prev])
      setShowModal(false)
      setForm({ name: '', clientName: '', address: '', postcode: '', status: 'active', budget: '', startDate: '', endDate: '' })
      setToast({ msg: 'Project created' })
      broadcastInvalidate('projects')
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed to create project', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="module-page" style={{ background: 'var(--bg0)', minHeight: '100dvh', paddingBottom: 100 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      {/* Header */}
      <div className="module-header" data-kicker="Portfolio command" style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--t1)', letterSpacing: -0.4, fontFamily: 'var(--font-system)' }}>Projects</h1>
            <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2, fontFamily: 'var(--font-system)' }}>{stats.active} active · {stats.snagging} snagging · {stats.quoting} quoting</p>
          </div>
          {canCreateProject && <button className="module-primary" onClick={() => setShowModal(true)} aria-label="Create new project" style={{ width: 36, height: 36, borderRadius: 10, background: '#f59e0b', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IcPlus size={18} color="#fff" />
          </button>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-raised)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 14px' }}>
          <IcSearch size={16} color="var(--t3)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects…" style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--t1)', fontFamily: 'var(--font-system)', fontSize: 14, flex: 1 }} />
        </div>
        {/* Status filter chips + Archived toggle */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, marginTop: 10 }}>
          {[{ id: 'all', label: 'All', count: projects.length }, { id: 'active', label: 'Active', count: stats.active }, { id: 'snagging', label: 'Snagging', count: stats.snagging }, { id: 'quoting', label: 'Quoting', count: stats.quoting }, { id: 'complete', label: 'Done', count: projects.filter(p => p.status === 'complete').length }].map(f => (
            <button key={f.id} onClick={() => setStatusFilter(f.id)} style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 99, border: 'none', background: statusFilter === f.id ? (f.id === 'all' ? '#f59e0b' : `${statusColor[f.id] || '#f59e0b'}`) : 'rgba(255,255,255,0.06)', color: statusFilter === f.id ? '#fff' : 'var(--t3)', fontFamily: 'var(--font-system)', fontSize: 12, fontWeight: statusFilter === f.id ? 700 : 400, cursor: 'pointer' }}>
              {f.label} {f.count > 0 && <span style={{ opacity: 0.8 }}>· {f.count}</span>}
            </button>
          ))}
          <button
            onClick={() => setShowArchived(v => !v)}
            style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 99, border: '1px dashed rgba(82,116,154,0.5)', background: showArchived ? 'rgba(82,116,154,0.2)' : 'transparent', color: 'var(--t2)', fontFamily: 'var(--font-system)', fontSize: 12, fontWeight: showArchived ? 700 : 400, cursor: 'pointer' }}
          >
            {showArchived ? '← Active' : 'Archived'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontFamily: 'var(--font-system)', fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: 'var(--font-system)', fontSize: 14 }}>{error}</div>
      ) : (
        <div className="module-list-grid" style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(project => <ProjectCard key={project.id} project={project} />)}
          {filtered.length === 0 && <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--t3)', fontFamily: 'var(--font-system)', fontSize: 14 }}>No projects found</div>}
        </div>
      )}

      <TabBar />

      {/* New project modal */}
      {showModal && canCreateProject && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div className="module-sheet" style={{ position: 'relative', background: 'var(--surface-raised)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ fontFamily: 'var(--font-system)', fontSize: 18, fontWeight: 700, color: 'var(--t1)' }}>New project</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="var(--t3)" /><span style={{ position: 'absolute', clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', height: 1, overflow: 'hidden', whiteSpace: 'nowrap', width: 1 }}>Close</span></button>
            </div>
            {[
              { key: 'name', label: 'Project name *', placeholder: 'Camden Mews Refurb' },
              { key: 'clientName', label: 'Client name', placeholder: 'Mr & Mrs Harrison' },
              { key: 'address', label: 'Address', placeholder: '14 Camden Mews, London' },
              { key: 'postcode', label: 'Postcode', placeholder: 'NW1 9AH' },
              { key: 'budget', label: 'Budget (£)', placeholder: '85000', type: 'number', min: '0' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: 'var(--t3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>{f.label}</label>
                <input
                  value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  type={(f as { type?: string }).type || 'text'}
                  min={(f as { min?: string }).min}
                  style={{ width: '100%', background: 'var(--bg3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: 'var(--t1)', fontFamily: 'var(--font-system)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            {/* Status */}
            <div>
              <label style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: 'var(--t3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>Status</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {STATUSES.map(s => (
                  <button key={s} onClick={() => setForm(p => ({ ...p, status: s }))} style={{ flex: 1, padding: '8px 4px', borderRadius: 10, background: form.status === s ? `${statusColor[s]}22` : 'rgba(255,255,255,0.05)', border: `1px solid ${form.status === s ? statusColor[s] : 'rgba(255,255,255,0.1)'}`, color: form.status === s ? statusColor[s] : 'var(--t2)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-system)', textTransform: 'capitalize' }}>
                    {statusLabel[s]}
                  </button>
                ))}
              </div>
            </div>
            {/* Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[{ key: 'startDate', label: 'Start date' }, { key: 'endDate', label: 'End date' }].map(f => (
                <div key={f.key}>
                  <label style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: 'var(--t3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>{f.label}</label>
                  <input type="date" value={form[f.key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={{ width: '100%', background: 'var(--bg3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: 'var(--t1)', fontFamily: 'var(--font-system)', fontSize: 14, outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }} />
                </div>
              ))}
            </div>
            <button onClick={createProject} disabled={saving || !form.name.trim()} style={{ marginTop: 4, padding: '14px 0', borderRadius: 14, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.name.trim() ? 0.5 : 1 }}>
              {saving ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const sc = statusColor[project.status] || 'var(--t3)'
  const onSiteMembers = project.assignments?.filter(a => a.onSite) || []
  const budget = project.budget > 0 ? `£${(project.budget / 1000).toFixed(0)}k` : '—'
  const margin = project.budget > 0 ? Math.round(((project.budget - project.spent) / project.budget) * 100) : 0

  return (
    <Link href={`/projects/${project.id}`} style={{ textDecoration: 'none' }}>
      <div style={{ background: 'var(--surface-raised)', borderRadius: 16, padding: '14px 14px', border: '0.5px solid rgba(255,255,255,0.07)', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--font-system)', fontSize: 10, fontWeight: 700, background: `${sc}22`, color: sc, padding: '2px 7px', borderRadius: 5 }}>
                {statusLabel[project.status] || project.status}
              </span>
              {project.status === 'active' && project.progress >= 85 && (
                <span style={{ fontFamily: 'var(--font-system)', fontSize: 10, fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '2px 7px', borderRadius: 5 }}>NEAR END</span>
              )}
            </div>
            <h3 style={{ fontFamily: 'var(--font-system)', fontSize: 16, fontWeight: 700, color: 'var(--t1)', letterSpacing: -0.2 }}>{project.name}</h3>
            <p style={{ fontFamily: 'var(--font-system)', fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>{project.clientName} · {project.postcode}</p>
          </div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 22, fontWeight: 700, color: sc, letterSpacing: -0.5, marginLeft: 10 }}>
            {project.progress}<span style={{ fontSize: 13, color: 'var(--t3)' }}>%</span>
          </div>
        </div>
        <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ width: `${project.progress}%`, height: '100%', background: sc, borderRadius: 2 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {onSiteMembers.length > 0 && (
              <div style={{ display: 'flex' }}>
                {onSiteMembers.slice(0, 3).map((a, i) => (
                  <div key={i} style={{ marginLeft: i ? -8 : 0 }}>
                    <Avatar name={a.member?.name || '?'} color={a.member?.avatarColor || '#2563eb'} size={24} ring ringColor="var(--surface-raised)" />
                  </div>
                ))}
                {onSiteMembers.length > 3 && (
                  <div style={{ marginLeft: -8, width: 24, height: 24, borderRadius: 12, background: 'var(--bg3)', border: '1.5px solid #152641', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-system)', fontSize: 9, fontWeight: 700, color: 'var(--t2)' }}>+{onSiteMembers.length - 3}</span>
                  </div>
                )}
              </div>
            )}
            <span style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: 'var(--t3)' }}>{project.onSiteCount} on site</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--t2)' }}>{budget}</span>
            {project.budget > 0 && (
              <span style={{ fontFamily: 'var(--font-system)', fontSize: 10, color: margin > 20 ? '#10b981' : margin > 10 ? '#f59e0b' : '#ef4444' }}>
                {margin}% margin
              </span>
            )}
            <IcChevR size={14} color="var(--t3)" />
          </div>
        </div>
      </div>
    </Link>
  )
}
