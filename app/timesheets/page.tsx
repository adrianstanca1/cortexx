'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcClock, IcChevL, IcChevR, IcPlus, IcCheck, IcX, IcSend, IcTrash } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Member { id: string; name: string; role: string }
interface Project { id: string; name: string }
interface TimeEntry {
  id: string
  memberId: string
  projectId: string | null
  date: string
  hours: number
  week: number
  year: number
  approved: boolean
  member?: Member
  project?: Project | null
}
interface ByMember {
  member: Member
  entries: TimeEntry[]
  totalHours: number
  approved: boolean
}

const SF = 'var(--font-system)'
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const PAYROLL_EMAIL = 'payroll@cortexbuild.app'

function isoWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { week, year: d.getUTCFullYear() }
}

function mondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() || 7
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (day - 1))
  return d
}

function fmtWeekRange(monday: Date): string {
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const m = monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const s = sunday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${m} – ${s}`
}

export default function TimesheetsPage() {
  const [monday, setMonday] = useState(() => mondayOf(new Date()))
  const [byMember, setByMember] = useState<ByMember[]>([])
  const [team, setTeam] = useState<Member[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const { week, year } = useMemo(() => isoWeek(monday), [monday])
  const isCurrentWeek = useMemo(() => {
    const now = isoWeek(new Date())
    return now.week === week && now.year === year
  }, [week, year])

  const [form, setForm] = useState({
    memberId: '',
    projectId: '',
    date: monday.toISOString().slice(0, 10),
    hours: '8',
  })

  useModalEffects(showAdd, () => setShowAdd(false))

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/timeentries?week=${week}&year=${year}`)
      .then(r => { if (!r.ok) throw new Error('Failed to load timesheets'); return r.json() })
      .then(d => { setByMember(d.byMember || []); setError(null); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [week, year])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/team').then(r => r.ok ? r.json() : null).then(d => {
      const ts: Member[] = (d?.team || []).map((m: { id: string; name: string; role: string }) => ({ id: m.id, name: m.name, role: m.role }))
      setTeam(ts)
      setForm(prev => prev.memberId ? prev : { ...prev, memberId: ts[0]?.id || '' })
    }).catch(() => {})
    fetch('/api/projects').then(r => r.ok ? r.json() : null).then(d => {
      const ps: Project[] = (d?.projects || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))
      setProjects(ps)
    }).catch(() => {})
  }, [])

  const shiftWeek = (delta: number) => {
    const next = new Date(monday)
    next.setDate(next.getDate() + delta * 7)
    setMonday(next)
  }
  const jumpToThisWeek = () => setMonday(mondayOf(new Date()))

  const addEntry = async () => {
    if (!form.memberId || !form.date || !form.hours) return
    const h = Number(form.hours)
    if (isNaN(h) || h <= 0 || h > 24) {
      setToast({ msg: 'Hours must be > 0 and ≤ 24', type: 'error' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/timeentries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: form.memberId,
          projectId: form.projectId || null,
          date: form.date,
          hours: h,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Failed')
      setShowAdd(false)
      setForm(prev => ({ ...prev, hours: '8' }))
      load()
      setToast({ msg: 'Entry added' })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed to add entry', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const toggleApprove = async (entry: TimeEntry) => {
    setApproving(entry.id)
    try {
      const res = await fetch(`/api/timeentries/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: !entry.approved }),
      })
      if (!res.ok) throw new Error('Failed')
      load()
    } catch {
      setToast({ msg: 'Approve failed', type: 'error' })
    } finally {
      setApproving(null)
    }
  }

  const approveMember = async (m: ByMember) => {
    const unapproved = m.entries.filter(e => !e.approved)
    if (!unapproved.length) return
    setApproving(m.member.id)
    try {
      await Promise.all(unapproved.map(e =>
        fetch(`/api/timeentries/${e.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approved: true }),
        })
      ))
      load()
      setToast({ msg: `Approved ${m.member.name}'s week` })
    } catch {
      setToast({ msg: 'Bulk approve failed', type: 'error' })
    } finally {
      setApproving(null)
    }
  }

  const removeEntry = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete(curr => curr === id ? null : curr), 3000)
      return
    }
    setConfirmDelete(null)
    try {
      const res = await fetch(`/api/timeentries/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      load()
    } catch {
      setToast({ msg: 'Delete failed', type: 'error' })
    }
  }

  const sendToPayroll = (m: ByMember) => {
    const regular = m.entries.reduce((s, e) => s + Math.min(e.hours, 8), 0)
    const overtime = m.totalHours - regular
    const lines = m.entries
      .map(e => `  ${new Date(e.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} — ${e.hours}h${e.project ? ` (${e.project.name})` : ''}`)
      .join('\n')
    const subject = `Timesheet — ${m.member.name} w/c ${monday.toLocaleDateString('en-GB')}`
    const body = `Hi Payroll,\n\nApproved timesheet for ${m.member.name} for the week commencing ${monday.toLocaleDateString('en-GB')}.\n\nRegular hours: ${regular.toFixed(1)}h\nOvertime hours: ${overtime.toFixed(1)}h\nTotal hours: ${m.totalHours.toFixed(1)}h\nStatus: ${m.approved ? 'Approved' : 'Pending approval'}\n\nDaily breakdown:\n${lines}\n\n— Cortexx`
    const url = `mailto:${PAYROLL_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.open(url, '_self')
  }

  // Day-by-day grid: index 0 = Mon
  const dayDate = (i: number) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d
  }
  const hoursOn = (entries: TimeEntry[], i: number) => {
    const target = dayDate(i).toISOString().slice(0, 10)
    return entries
      .filter(e => e.date.slice(0, 10) === target)
      .reduce((s, e) => s + e.hours, 0)
  }

  const weekTotal = byMember.reduce((s, m) => s + m.totalHours, 0)
  const weekApproved = byMember.every(m => m.approved) && byMember.length > 0
  const pendingMembers = byMember.filter(m => !m.approved).length

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
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Timesheets</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              Wk {week} · {weekTotal.toFixed(1)}h logged
              {pendingMembers > 0 && <span style={{ color: '#f59e0b', marginLeft: 6 }}>· {pendingMembers} pending</span>}
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} aria-label="Add entry" disabled={team.length === 0} style={{ width: 36, height: 36, borderRadius: 10, background: team.length === 0 ? 'rgba(139,92,246,0.3)' : '#8b5cf6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: team.length === 0 ? 'not-allowed' : 'pointer' }}>
            <IcPlus size={18} color="#fff" />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => shiftWeek(-1)} aria-label="Previous week" style={navBtn}><IcChevL size={16} color="#8ea8c5" /></button>
          <div style={{ flex: 1, textAlign: 'center', fontFamily: SF, fontSize: 13, color: '#eef3fa', fontWeight: 600 }}>
            {fmtWeekRange(monday)} {isCurrentWeek && <span style={{ color: '#10b981', fontSize: 11, marginLeft: 6 }}>· this week</span>}
          </div>
          <button onClick={() => shiftWeek(1)} aria-label="Next week" style={navBtn}><IcChevR size={16} color="#8ea8c5" /></button>
          {!isCurrentWeek && (
            <button onClick={jumpToThisWeek} style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(139,92,246,0.15)', border: '0.5px solid rgba(139,92,246,0.35)', color: '#a78bfa', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Today</button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: SF, fontSize: 14 }}>{error}</div>
      ) : byMember.length === 0 ? (
        <div style={{ padding: '60px 40px', textAlign: 'center', color: '#52749a', fontFamily: SF }}>
          <IcClock size={32} color="#52749a" />
          <p style={{ marginTop: 12, fontSize: 14 }}>No hours logged for this week</p>
          {team.length > 0 && (
            <button onClick={() => setShowAdd(true)} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#8b5cf6', border: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Log first hours
            </button>
          )}
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {weekApproved && (
            <div style={{ padding: '8px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.12)', border: '0.5px solid rgba(16,185,129,0.35)', color: '#10b981', fontFamily: SF, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IcCheck size={14} color="#10b981" /> Whole week approved
            </div>
          )}
          {byMember.map(m => (
            <div key={m.member.id} style={{ background: '#152641', borderRadius: 14, padding: '14px', border: '0.5px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: '#eef3fa' }}>{m.member.name}</div>
                  <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', marginTop: 2 }}>{m.member.role || 'Member'} · {m.totalHours.toFixed(1)}h</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ padding: '3px 9px', borderRadius: 99, background: m.approved ? 'rgba(16,185,129,0.18)' : 'rgba(245,158,11,0.18)', color: m.approved ? '#10b981' : '#f59e0b', fontFamily: SF, fontSize: 10, fontWeight: 700, border: `1px solid ${m.approved ? 'rgba(16,185,129,0.45)' : 'rgba(245,158,11,0.45)'}` }}>
                    {m.approved ? 'Approved' : 'Pending'}
                  </span>
                  {!m.approved && (
                    <button onClick={() => approveMember(m)} disabled={approving === m.member.id} aria-label={`Approve ${m.member.name}'s week`} style={{ background: 'rgba(16,185,129,0.2)', border: '0.5px solid rgba(16,185,129,0.4)', color: '#10b981', borderRadius: 8, padding: '3px 9px', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      {approving === m.member.id ? '…' : '✓ Week'}
                    </button>
                  )}
                  <button onClick={() => sendToPayroll(m)} aria-label="Send to payroll" style={{ background: 'rgba(139,92,246,0.2)', border: '0.5px solid rgba(139,92,246,0.4)', color: '#a78bfa', borderRadius: 8, padding: '3px 9px', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <IcSend size={11} color="#a78bfa" />
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
                {DAYS.map((day, i) => {
                  const hrs = hoursOn(m.entries, i)
                  const isToday = isCurrentWeek && new Date().getDay() === (i === 6 ? 0 : i + 1)
                  return (
                    <div key={day} style={{ padding: '6px 4px', borderRadius: 6, background: hrs > 0 ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)', border: isToday ? '0.5px solid rgba(139,92,246,0.4)' : '0.5px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                      <div style={{ fontFamily: SF, fontSize: 9, color: '#52749a', fontWeight: 700, textTransform: 'uppercase' }}>{day}</div>
                      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: hrs > 0 ? '#eef3fa' : '#52749a', fontWeight: 600, marginTop: 2 }}>{hrs > 0 ? hrs.toFixed(1) : '–'}</div>
                    </div>
                  )
                })}
              </div>

              <details style={{ marginTop: 4 }}>
                <summary style={{ cursor: 'pointer', fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 600 }}>{m.entries.length} {m.entries.length === 1 ? 'entry' : 'entries'}</summary>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {m.entries.map(e => (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', minWidth: 70 }}>
                        {new Date(e.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}
                      </div>
                      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#eef3fa', fontWeight: 600, minWidth: 36 }}>{e.hours}h</div>
                      <div style={{ flex: 1, fontFamily: SF, fontSize: 11, color: '#52749a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.project?.name || 'No project'}
                      </div>
                      <button onClick={() => toggleApprove(e)} disabled={approving === e.id} aria-label={e.approved ? 'Unapprove' : 'Approve'} style={{ background: 'transparent', border: 'none', padding: 2, cursor: 'pointer' }}>
                        <IcCheck size={12} color={e.approved ? '#10b981' : '#52749a'} />
                      </button>
                      <button onClick={() => removeEntry(e.id)} aria-label={confirmDelete === e.id ? 'Confirm delete' : 'Delete entry'} style={{ background: confirmDelete === e.id ? 'rgba(239,68,68,0.18)' : 'transparent', border: 'none', borderRadius: 4, padding: confirmDelete === e.id ? '2px 6px' : 2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <IcTrash size={11} color="#ef4444" />
                        {confirmDelete === e.id && <span style={{ fontFamily: SF, fontSize: 9, color: '#ef4444', fontWeight: 700 }}>Sure?</span>}
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          ))}
        </div>
      )}

      <TabBar />

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowAdd(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.3, fontFamily: SF }}>Log hours</h2>
              <button onClick={() => setShowAdd(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>

            <div>
              <label style={labelStyle}>Member</label>
              <select value={form.memberId} onChange={e => setForm(p => ({ ...p, memberId: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Project (optional)</label>
              <select value={form.projectId} onChange={e => setForm(p => ({ ...p, projectId: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                <option value="">— Unassigned —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
              <div>
                <label style={labelStyle}>Hours</label>
                <input type="number" min="0.25" max="24" step="0.25" value={form.hours} onChange={e => setForm(p => ({ ...p, hours: e.target.value }))} style={inputStyle} />
              </div>
            </div>

            <button onClick={addEntry} disabled={saving || !form.memberId || !form.date || !form.hours} style={{ marginTop: 4, padding: '14px 0', borderRadius: 14, background: '#8b5cf6', border: 'none', color: '#fff', fontFamily: SF, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.memberId || !form.date || !form.hours ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? 'Saving…' : <><IcCheck size={16} color="#fff" /> Log entry</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const navBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
}
const labelStyle: React.CSSProperties = {
  fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#eef3fa', fontFamily: SF, fontSize: 14, outline: 'none', boxSizing: 'border-box',
}
