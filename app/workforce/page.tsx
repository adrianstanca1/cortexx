'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'

type Member = { id: string; name: string; role: string; email?: string | null; avatarColor?: string }
type Project = { id: string; name: string; status: string }
type Assignment = { id: string; projectId: string; memberId: string; onSite: boolean; role?: string | null }
type WorkspaceUser = { role: string; organizationRole: string }

const panel: React.CSSProperties = { border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, background: 'var(--bg2)', padding: 16 }
const button: React.CSSProperties = { padding: '9px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,.15)', background: 'var(--bg3)', color: 'var(--t1)', fontWeight: 700, cursor: 'pointer', fontSize: 12 }

/** Replaces the legacy simulated drag-and-drop with durable project assignments. */
export default function WorkforcePlannerPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [user, setUser] = useState<WorkspaceUser | null>(null)
  const [projectId, setProjectId] = useState('')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const paths = ['/api/team', '/api/projects?take=100', '/api/assignments', '/api/mobile/auth/me']
      const responses = await Promise.all(paths.map(url => fetch(url, { cache: 'no-store' })))
      if (responses.some(r => !r.ok)) throw new Error('Unable to load your company workforce and project access. Please retry.')
      const [teamData, projectData, assignmentData, identity] = await Promise.all(responses.map(r => r.json()))
      setMembers(teamData.team || [])
      setProjects(projectData.projects || [])
      setAssignments(assignmentData.assignments || [])
      setUser(identity.user || null)
      setProjectId(previous => (projectData.projects || []).some((p: Project) => p.id === previous)
        ? previous : (projectData.projects || [])[0]?.id || '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load workforce')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const canEdit = ['owner', 'admin'].includes(user?.organizationRole || '') ||
    (user?.organizationRole === 'member' && user?.role === 'project_manager')
  const selected = projects.find(p => p.id === projectId)
  const projectAssignments = useMemo(() => assignments.filter(a => a.projectId === projectId), [assignments, projectId])
  const visible = useMemo(() => members.filter(member =>
    `${member.name} ${member.role} ${member.email || ''}`.toLowerCase().includes(search.toLowerCase())), [members, search])
  const assigned = useMemo(() => new Map(projectAssignments.map(a => [a.memberId, a])), [projectAssignments])

  const changeAssignment = async (member: Member) => {
    if (!canEdit || !projectId || busy) return
    const existing = assigned.get(member.id)
    setBusy(member.id); setError(''); setSuccess('')
    try {
      const response = await fetch(existing ? `/api/assignments/${encodeURIComponent(existing.id)}` : '/api/assignments', {
        method: existing ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(!existing ? { body: JSON.stringify({ projectId, memberId: member.id, role: member.role }) } : {}),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Unable to update assignment')
      // Read back the authoritative database state; never fake a saved move.
      const refreshed = await fetch('/api/assignments', { cache: 'no-store' })
      if (!refreshed.ok) throw new Error('Assignment saved, but the updated team could not be refreshed')
      const data = await refreshed.json()
      setAssignments(data.assignments || [])
      setSuccess(`${member.name} ${existing ? 'removed from' : 'assigned to'} ${selected?.name || 'the project'}`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update assignment') }
    finally { setBusy(null) }
  }

  return <main className="module-page" style={{ minHeight: '100dvh', background: 'var(--bg0)', padding: '24px 20px 110px', color: 'var(--t1)' }}>
    <div style={{ maxWidth: 1050, margin: '0 auto', fontFamily: 'var(--font-system)' }}>
      <Link href="/team" style={{ color: 'var(--t2)', fontSize: 13, textDecoration: 'none' }}>← Team</Link>
      <h1 style={{ marginTop: 15, fontSize: 29, fontWeight: 800 }}>Workforce planner</h1>
      <p style={{ marginTop: 5, color: 'var(--t2)', fontSize: 13 }}>Real project assignments shared across Cortex Construct web and mobile accounts.</p>
      <div style={{ ...panel, marginTop: 22 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: 12 }}>
          <div style={{ flex: 2, minWidth: 220 }}>
            <label htmlFor="workforce-project" style={{ display: 'block', fontSize: 12, marginBottom: 7 }}>Project</label>
            <select id="workforce-project" value={projectId} onChange={e => { setProjectId(e.target.value); setSuccess('') }} style={{ ...button, width: '100%', textAlign: 'left' }}>
              {!projects.length && <option value="">No accessible projects</option>}
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 2, minWidth: 190 }}>
            <label htmlFor="workforce-search" style={{ display: 'block', fontSize: 12, marginBottom: 7 }}>Find team member</label>
            <input id="workforce-search" placeholder="Search names or roles" value={search} onChange={e => setSearch(e.target.value)} style={{ ...button, width: '100%', boxSizing: 'border-box' }} />
          </div>
          <button type="button" onClick={() => void load()} style={button} disabled={loading || !!busy}>Refresh</button>
        </div>
        {selected && <p style={{ fontSize: 12, color: 'var(--t2)', marginTop: 14 }}>
          {projectAssignments.length} assigned · {members.length} visible team members · {canEdit ? 'Changes are saved to the company database' : 'View only — your role cannot change assignments'}
        </p>}
      </div>

      {error && <p role="alert" style={{ ...panel, color: '#fb7185', marginTop: 12 }}>{error}</p>}
      {success && <p role="status" style={{ ...panel, color: '#34d399', marginTop: 12 }}>{success}</p>}
      {loading ? <p style={{ marginTop: 30, color: 'var(--t2)' }}>Loading workforce…</p> : !selected ?
        <p style={{ marginTop: 30, color: 'var(--t2)' }}>No projects available for this company account.</p> :
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))', gap: 14, marginTop: 16 }}>
          <section style={panel} aria-label="Assigned team">
            <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>Assigned ({visible.filter(m => assigned.has(m.id)).length})</h2>
            {visible.filter(m => assigned.has(m.id)).map(member => <div key={member.id} style={{ borderBottom: '1px solid rgba(255,255,255,.08)', padding: '11px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}><p style={{ fontWeight: 700, fontSize: 13 }}>{member.name}</p><p style={{ color: 'var(--t2)', fontSize: 11 }}>{member.role}</p></div>
              {canEdit && <button type="button" disabled={!!busy} aria-label={`Remove ${member.name} from ${selected.name}`} onClick={() => void changeAssignment(member)} style={button}>{busy === member.id ? 'Saving…' : 'Remove'}</button>}
            </div>)}
            {!visible.some(m => assigned.has(m.id)) && <p style={{ color: 'var(--t3)', fontSize: 12 }}>No matching assignments.</p>}
          </section>
          <section style={panel} aria-label="Available team">
            <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>Available ({visible.filter(m => !assigned.has(m.id)).length})</h2>
            {visible.filter(m => !assigned.has(m.id)).map(member => <div key={member.id} style={{ borderBottom: '1px solid rgba(255,255,255,.08)', padding: '11px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}><p style={{ fontWeight: 700, fontSize: 13 }}>{member.name}</p><p style={{ color: 'var(--t2)', fontSize: 11 }}>{member.role}</p></div>
              {canEdit && <button type="button" disabled={!!busy} aria-label={`Assign ${member.name} to ${selected.name}`} onClick={() => void changeAssignment(member)} style={{ ...button, background: '#0e7490', color: '#fff' }}>{busy === member.id ? 'Saving…' : 'Assign'}</button>}
            </div>)}
            {!visible.some(m => !assigned.has(m.id)) && <p style={{ color: 'var(--t3)', fontSize: 12 }}>No matching available members.</p>}
          </section>
        </div>}
      <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 20 }}>A team member can belong to multiple projects. Removing someone here changes only their selected-project assignment, not their account or other work.</p>
    </div>
    <TabBar />
  </main>
}
