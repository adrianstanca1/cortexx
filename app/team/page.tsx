'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import MobileHeader from '@/components/ui/MobileHeader'
import Avatar from '@/components/ui/Avatar'
import { IcCheck, IcClock, IcPlus, IcX, IcEdit } from '@/components/ui/Icons'
import Toast from '@/components/ui/Toast'
import { useModalEffects } from '@/lib/useModalEffects'
import type { TeamMember } from '@/lib/types'

const AVATAR_COLORS = ['#2563eb', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']

interface TimesheetEntry {
  member: TeamMember
  entries: { id: string; hours: number; approved: boolean; project?: { name: string } | null }[]
  totalHours: number
  approved: boolean
}

export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [timesheets, setTimesheets] = useState<TimesheetEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tsLoading, setTsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'members' | 'timesheets'>('members')
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showHoursModal, setShowHoursModal] = useState(false)
  const [editTarget, setEditTarget] = useState<TeamMember | null>(null)
  const [approving, setApproving] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', role: '', email: '', phone: '', dailyRate: '', avatarColor: AVATAR_COLORS[0] })
  const [editForm, setEditForm] = useState({ name: '', role: '', email: '', phone: '', dailyRate: '', avatarColor: AVATAR_COLORS[0] })
  const [hoursForm, setHoursForm] = useState({ memberId: '', projectId: '', hours: '', date: new Date().toISOString().slice(0, 10) })
  const [saving, setSaving] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [savingHours, setSavingHours] = useState(false)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)

  useModalEffects(showModal, () => setShowModal(false))
  useModalEffects(showEditModal, () => { setShowEditModal(false); setEditTarget(null) })
  useModalEffects(showHoursModal, () => setShowHoursModal(false))

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: '11px 14px', color: '#eef3fa',
    fontFamily: 'var(--font-system)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6,
  }

  useEffect(() => {
    fetch('/api/team')
      .then(r => { if (!r.ok) throw new Error('Failed to load team'); return r.json() })
      .then(data => { setTeam(data.team || []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
    fetch('/api/projects')
      .then(r => r.json())
      .then(d => setProjects((d.projects || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (tab !== 'timesheets') return
    setTsLoading(true)
    fetch('/api/timeentries')
      .then(r => r.json())
      .then(data => { setTimesheets(data.byMember || []); setTsLoading(false) })
      .catch(() => setTsLoading(false))
  }, [tab])

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new') === '1') {
      setShowModal(true)
    }
  }, [])

  const onSiteCount = team.filter(m => m.onSite).length
  const pendingCount = timesheets.filter(t => !t.approved).length

  const approveAll = async (memberId: string, entries: TimesheetEntry['entries']) => {
    setApproving(memberId)
    try {
      const pending = entries.filter(e => !e.approved)
      const results = await Promise.allSettled(
        pending.map(e =>
          fetch(`/api/timeentries/${e.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approved: true }),
          }).then(r => { if (!r.ok) throw new Error('API error'); return r })
        )
      )
      const failed = results.filter(r => r.status === 'rejected').length
      const succeeded = results.length - failed
      const succeededIds = new Set(pending.filter((_, i) => results[i].status === 'fulfilled').map(e => e.id))
      setTimesheets(prev => prev.map(t =>
        t.member.id === memberId
          ? { ...t, entries: t.entries.map(e => succeededIds.has(e.id) ? { ...e, approved: true } : e), approved: t.entries.every(e => e.approved || succeededIds.has(e.id)) }
          : t
      ))
      if (failed === 0) setToast({ msg: 'Timesheet approved' })
      else setToast({ msg: `Approved ${succeeded}, ${failed} failed`, type: 'error' })
    } catch { setToast({ msg: 'Failed to approve', type: 'error' }) }
    finally { setApproving(null) }
  }

  const createMember = async () => {
    if (!form.name.trim() || !form.role.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          role: form.role.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          dailyRate: parseFloat(form.dailyRate) || 0,
          avatarColor: form.avatarColor,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const newMember = await res.json()
      setTeam(prev => [...prev, { ...newMember, hoursThisWeek: 0 }])
      setShowModal(false)
      setForm({ name: '', role: '', email: '', phone: '', dailyRate: '', avatarColor: AVATAR_COLORS[0] })
      setToast({ msg: `${newMember.name} added` })
    } catch { setToast({ msg: 'Failed to add member', type: 'error' }) }
    finally { setSaving(false) }
  }

  const openEditModal = (member: TeamMember) => {
    setEditTarget(member)
    setEditForm({
      name: member.name,
      role: member.role,
      email: member.email || '',
      phone: member.phone || '',
      dailyRate: member.dailyRate.toString(),
      avatarColor: member.avatarColor,
    })
    setConfirmDelete(false)
    setShowEditModal(true)
  }

  const saveMemberEdit = async () => {
    if (!editTarget || !editForm.name.trim() || !editForm.role.trim()) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/team/${editTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          role: editForm.role.trim(),
          email: editForm.email.trim() || null,
          phone: editForm.phone.trim() || null,
          dailyRate: parseFloat(editForm.dailyRate) || 0,
          avatarColor: editForm.avatarColor,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const updated = await res.json()
      setTeam(prev => prev.map(m => m.id === editTarget.id ? { ...m, ...updated } : m))
      setShowEditModal(false)
      setEditTarget(null)
      setToast({ msg: 'Member updated' })
    } catch { setToast({ msg: 'Failed to update member', type: 'error' }) }
    finally { setSavingEdit(false) }
  }

  const deleteMember = async () => {
    if (!editTarget) return
    try {
      const res = await fetch(`/api/team/${editTarget.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setTeam(prev => prev.filter(m => m.id !== editTarget.id))
      setShowEditModal(false)
      setEditTarget(null)
      setConfirmDelete(false)
      setToast({ msg: 'Member removed' })
    } catch { setToast({ msg: 'Failed to remove member', type: 'error' }) }
  }

  const toggleOnSite = async (member: TeamMember) => {
    if (togglingIds.has(member.id)) return
    setTogglingIds(prev => new Set(prev).add(member.id))
    const originalOnSite = member.onSite
    setTeam(prev => prev.map(m => m.id === member.id ? { ...m, onSite: !originalOnSite } : m))
    try {
      const res = await fetch(`/api/team/${member.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onSite: !originalOnSite }),
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      setTeam(prev => prev.map(m => m.id === member.id ? { ...m, onSite: originalOnSite } : m))
      setToast({ msg: 'Failed to update on-site status', type: 'error' })
    } finally {
      setTogglingIds(prev => { const next = new Set(prev); next.delete(member.id); return next })
    }
  }

  const logHours = async () => {
    if (!hoursForm.memberId || !hoursForm.hours || !hoursForm.date) return
    setSavingHours(true)
    try {
      await fetch('/api/timeentries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: hoursForm.memberId,
          projectId: hoursForm.projectId || null,
          hours: parseFloat(hoursForm.hours),
          date: hoursForm.date,
          approved: false,
        }),
      })
      const data = await fetch('/api/timeentries').then(r => r.json())
      setTimesheets(data.byMember || [])
      setTeam(prev => prev.map(m => {
        if (m.id !== hoursForm.memberId) return m
        return { ...m, hoursThisWeek: (m.hoursThisWeek || 0) + parseFloat(hoursForm.hours) }
      }))
      setShowHoursModal(false)
      setHoursForm(p => ({ ...p, memberId: '', projectId: '', hours: '' }))
      setToast({ msg: 'Hours logged' })
    } catch { setToast({ msg: 'Failed to log hours', type: 'error' }) }
    finally { setSavingHours(false) }
  }

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <MobileHeader title="Team" subtitle={`${team.length} members · ${onSiteCount} on site`} notifCount={0} />

      {/* Tab switch */}
      <div style={{ display: 'flex', padding: '10px 16px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {(['members', 'timesheets'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '10px 4px', border: 'none', background: 'transparent', fontSize: 13, fontWeight: t === tab ? 600 : 400, color: t === tab ? '#f59e0b' : '#52749a', cursor: 'pointer', fontFamily: 'var(--font-system)', borderBottom: t === tab ? '2px solid #f59e0b' : '2px solid transparent', marginBottom: -1, textTransform: 'capitalize' }}>
            {t === 'timesheets' && pendingCount > 0 ? `Timesheets (${pendingCount})` : t}
          </button>
        ))}
      </div>

      {/* Members tab */}
      {tab === 'members' && (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            [1, 2, 3, 4].map(i => <div key={i} style={{ height: 80, borderRadius: 16, background: 'rgba(255,255,255,0.04)' }} />)
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#ef4444', fontFamily: 'var(--font-system)', fontSize: 14 }}>{error}</div>
          ) : (
            team.map(member => (
              <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 16, background: member.onSite ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.04)', border: `1px solid ${member.onSite ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.07)'}` }}>
                <div onClick={() => toggleOnSite(member)} style={{ position: 'relative', cursor: 'pointer' }}>
                  <Avatar name={member.name} color={member.avatarColor} size={44} />
                  {member.onSite && <div style={{ position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: '50%', background: '#10b981', border: '2px solid #06101e' }} />}
                </div>
                <Link href={`/team/${member.id}`} style={{ flex: 1, textDecoration: 'none' }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#eef3fa', fontFamily: 'var(--font-system)', letterSpacing: '-0.01em' }}>{member.name}</p>
                  <p style={{ fontSize: 12, color: '#8ea8c5', fontFamily: 'var(--font-system)', marginTop: 1 }}>{member.role}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <IcClock size={11} color="#52749a" />
                    <span style={{ fontSize: 11, color: '#52749a', fontFamily: 'var(--font-system)' }}>{member.hoursThisWeek || 0}h this week</span>
                    {member.dailyRate > 0 && <>
                      <span style={{ color: '#1a2f4e' }}>·</span>
                      <span style={{ fontSize: 11, color: '#52749a', fontFamily: 'var(--font-system)' }}>£{member.dailyRate}/day</span>
                    </>}
                  </div>
                </Link>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  {member.onSite && <span style={{ fontSize: 9, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.15)', padding: '3px 8px', borderRadius: 99, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-system)' }}>On site</span>}
                  <button onClick={() => openEditModal(member)} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <IcEdit size={13} color="#8ea8c5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Timesheets tab */}
      {tab === 'timesheets' && (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
            <button onClick={() => { setHoursForm(p => ({ ...p, memberId: team[0]?.id || '' })); setShowHoursModal(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: '#2563eb', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <IcPlus size={14} color="#fff" /> Log hours
            </button>
          </div>
          {pendingCount > 0 && (
            <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
              <p style={{ flex: 1, fontSize: 12, color: '#f59e0b', fontFamily: 'var(--font-system)', fontWeight: 600 }}>
                {pendingCount} timesheet{pendingCount !== 1 ? 's' : ''} pending approval
              </p>
              <button
                onClick={async () => {
                  if (!window.confirm(`Approve all ${pendingCount} timesheet${pendingCount !== 1 ? 's' : ''} for this week?`)) return
                  // Get current ISO week/year via first entry, or fall back
                  const sample = timesheets.find(t => !t.approved)?.entries[0]
                  if (!sample) return
                  const res = await fetch('/api/timeentries').then(r => r.json())
                  await fetch('/api/timeentries/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'approve', week: res.week, year: res.year }),
                  })
                  // Refresh
                  const fresh = await fetch('/api/timeentries').then(r => r.json())
                  setTimesheets(fresh.byMember || [])
                  setToast({ msg: 'All timesheets approved' })
                }}
                style={{ padding: '6px 12px', borderRadius: 8, background: '#f59e0b', border: 'none', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-system)' }}
              >
                Approve all
              </button>
            </div>
          )}
          {tsLoading ? (
            [1, 2, 3].map(i => <div key={i} style={{ height: 70, borderRadius: 14, background: 'rgba(255,255,255,0.04)' }} />)
          ) : timesheets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#52749a', fontFamily: 'var(--font-system)', fontSize: 14 }}>No time entries this week</div>
          ) : (
            timesheets.map(ts => (
              <div key={ts.member.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: ts.approved ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.04)', border: `1px solid ${ts.approved ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.07)'}` }}>
                <Avatar name={ts.member.name} color={ts.member.avatarColor} size={36} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#eef3fa', fontFamily: 'var(--font-system)' }}>{ts.member.name}</p>
                  <p style={{ fontSize: 11, color: '#52749a', fontFamily: 'var(--font-system)', marginTop: 1 }}>
                    {ts.totalHours}h · {ts.entries.length} entr{ts.entries.length !== 1 ? 'ies' : 'y'}
                    {ts.entries[0]?.project && ` · ${ts.entries[0].project.name}`}
                  </p>
                </div>
                {ts.approved ? (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.15)', padding: '3px 8px', borderRadius: 99, letterSpacing: '0.06em', fontFamily: 'var(--font-system)' }}>APPROVED</span>
                ) : (
                  <button onClick={() => approveAll(ts.member.id, ts.entries)} disabled={approving === ts.member.id}
                    style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', fontSize: 12, fontWeight: 600, color: '#10b981', cursor: 'pointer', fontFamily: 'var(--font-system)', display: 'flex', alignItems: 'center', gap: 4, opacity: approving === ts.member.id ? 0.5 : 1 }}>
                    <IcCheck size={12} color="#10b981" />
                    {approving === ts.member.id ? '…' : 'Approve'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Add member FAB */}
      <button onClick={() => setShowModal(true)} style={{ position: 'fixed', bottom: 88, right: 20, width: 52, height: 52, borderRadius: '50%', background: '#f59e0b', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 16px rgba(245,158,11,0.4)', zIndex: 50 }}>
        <IcPlus size={22} color="#fff" />
      </button>

      {/* Add member modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ fontFamily: 'var(--font-system)', fontSize: 18, fontWeight: 700, color: '#eef3fa' }}>Add team member</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /><span style={{ position: 'absolute', clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', height: 1, overflow: 'hidden', whiteSpace: 'nowrap', width: 1 }}>Close</span></button>
            </div>
            {[
              { key: 'name', label: 'Full name *', placeholder: 'Tom Reilly' },
              { key: 'role', label: 'Role *', placeholder: 'Site Manager' },
              { key: 'email', label: 'Email', placeholder: 'tom@company.com' },
              { key: 'phone', label: 'Phone', placeholder: '07700 900123' },
              { key: 'dailyRate', label: 'Daily rate (£)', placeholder: '280' },
            ].map(f => (
              <div key={f.key}>
                <label style={labelStyle}>{f.label}</label>
                <input value={form[f.key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} type={f.key === 'dailyRate' ? 'number' : f.key === 'email' ? 'email' : 'text'} min={f.key === 'dailyRate' ? '0' : undefined} style={inputStyle} />
              </div>
            ))}
            <div>
              <label style={labelStyle}>Avatar colour</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {AVATAR_COLORS.map(c => (
                  <button key={c} onClick={() => setForm(p => ({ ...p, avatarColor: c }))} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: form.avatarColor === c ? '3px solid #fff' : '3px solid transparent', cursor: 'pointer', flexShrink: 0 }} />
                ))}
              </div>
            </div>
            <button onClick={createMember} disabled={saving || !form.name.trim() || !form.role.trim()} style={{ marginTop: 4, padding: '14px 0', borderRadius: 14, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.name.trim() || !form.role.trim() ? 0.5 : 1 }}>
              {saving ? 'Adding…' : 'Add member'}
            </button>
          </div>
        </div>
      )}

      {/* Edit member modal */}
      {showEditModal && editTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowEditModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ fontFamily: 'var(--font-system)', fontSize: 18, fontWeight: 700, color: '#eef3fa' }}>Edit {editTarget.name}</h3>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /><span style={{ position: 'absolute', clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', height: 1, overflow: 'hidden', whiteSpace: 'nowrap', width: 1 }}>Close</span></button>
            </div>
            {[
              { key: 'name', label: 'Full name *', placeholder: 'Tom Reilly' },
              { key: 'role', label: 'Role *', placeholder: 'Site Manager' },
              { key: 'email', label: 'Email', placeholder: 'tom@company.com' },
              { key: 'phone', label: 'Phone', placeholder: '07700 900123' },
              { key: 'dailyRate', label: 'Daily rate (£)', placeholder: '280' },
            ].map(f => (
              <div key={f.key}>
                <label style={labelStyle}>{f.label}</label>
                <input value={editForm[f.key as keyof typeof editForm]} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} type={f.key === 'dailyRate' ? 'number' : f.key === 'email' ? 'email' : 'text'} min={f.key === 'dailyRate' ? '0' : undefined} style={inputStyle} />
              </div>
            ))}
            <div>
              <label style={labelStyle}>Avatar colour</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {AVATAR_COLORS.map(c => (
                  <button key={c} onClick={() => setEditForm(p => ({ ...p, avatarColor: c }))} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: editForm.avatarColor === c ? '3px solid #fff' : '3px solid transparent', cursor: 'pointer', flexShrink: 0 }} />
                ))}
              </div>
            </div>
            <button onClick={saveMemberEdit} disabled={savingEdit || !editForm.name.trim() || !editForm.role.trim()} style={{ marginTop: 4, padding: '14px 0', borderRadius: 14, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: savingEdit || !editForm.name.trim() || !editForm.role.trim() ? 0.5 : 1 }}>
              {savingEdit ? 'Saving…' : 'Save changes'}
            </button>
            {confirmDelete ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: '12px 0', borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#8ea8c5', fontFamily: 'var(--font-system)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button onClick={deleteMember} style={{ flex: 1, padding: '12px 0', borderRadius: 14, background: '#ef4444', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Confirm remove</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} style={{ padding: '12px 0', borderRadius: 14, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontFamily: 'var(--font-system)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Remove from team
              </button>
            )}
          </div>
        </div>
      )}

      {/* Log hours modal */}
      {showHoursModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowHoursModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ fontFamily: 'var(--font-system)', fontSize: 18, fontWeight: 700, color: '#eef3fa' }}>Log hours</h3>
              <button onClick={() => setShowHoursModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /><span style={{ position: 'absolute', clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', height: 1, overflow: 'hidden', whiteSpace: 'nowrap', width: 1 }}>Close</span></button>
            </div>
            <div>
              <label style={labelStyle}>Team member *</label>
              <select value={hoursForm.memberId} onChange={e => setHoursForm(p => ({ ...p, memberId: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                <option value="">Select member</option>
                {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Project (optional)</label>
              <select value={hoursForm.projectId} onChange={e => setHoursForm(p => ({ ...p, projectId: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                <option value="">No project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Hours *</label>
              <input type="number" step="0.5" min="0.5" max="24" value={hoursForm.hours} onChange={e => setHoursForm(p => ({ ...p, hours: e.target.value }))} placeholder="8" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" value={hoursForm.date} onChange={e => setHoursForm(p => ({ ...p, date: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>
            <button onClick={logHours} disabled={savingHours || !hoursForm.memberId || !hoursForm.hours} style={{ marginTop: 4, padding: '14px 0', borderRadius: 14, background: '#2563eb', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: savingHours || !hoursForm.memberId || !hoursForm.hours ? 0.5 : 1 }}>
              {savingHours ? 'Logging…' : 'Log hours'}
            </button>
          </div>
        </div>
      )}

      <TabBar accent="#f59e0b" />
    </div>
  )
}
