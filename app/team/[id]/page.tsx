'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Avatar from '@/components/ui/Avatar'
import TabBar from '@/components/ui/TabBar'
import CertificationDialog from '@/components/training/CertificationDialog'
import Toast from '@/components/ui/Toast'
import { IcChevL, IcCheck, IcClock, IcPin, IcPlus, IcEdit } from '@/components/ui/Icons'
import type { Certification, TrainingCourse } from '@/lib/types'

interface ProjectAssignment {
  id: string
  role: string | null
  onSite: boolean
  project: { id: string; name: string; status: string }
}

interface TimeEntryItem {
  id: string
  date: string
  hours: number
  approved: boolean
  project?: { name: string } | null
}

interface MemberDetail {
  id: string
  name: string
  role: string
  email: string | null
  phone: string | null
  avatarColor: string
  dailyRate: number
  onSite: boolean
  assignments: ProjectAssignment[]
  timeEntries: TimeEntryItem[]
  certifications: Certification[]
}

const statusColor: Record<string, string> = { active: '#10b981', snagging: '#f59e0b', quoting: '#8b5cf6', complete: '#52749a' }
const EXPIRING_WINDOW_DAYS = 60

function bucket(expiry: string | null): Certification['statusBucket'] {
  if (!expiry) return 'no_expiry'
  const ms = new Date(expiry).getTime() - Date.now()
  if (ms < 0) return 'expired'
  if (ms < EXPIRING_WINDOW_DAYS * 86_400_000) return 'expiring'
  return 'valid'
}

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [member, setMember] = useState<MemberDetail | null>(null)
  const [team, setTeam] = useState<Array<{ id: string; name: string; role: string }>>([])
  const [courses, setCourses] = useState<TrainingCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Certification | null>(null)

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      fetch(`/api/team/${id}`).then(r => { if (!r.ok) throw new Error('Member not found'); return r.json() }),
      fetch('/api/team').then(r => r.ok ? r.json() : null),
      fetch('/api/training/courses').then(r => r.ok ? r.json() : null),
    ])
      .then(([memberData, teamData, courseData]) => {
        setMember(memberData.member)
        const ts = (teamData?.team || []).map((m: { id: string; name: string; role: string }) => ({ id: m.id, name: m.name, role: m.role }))
        setTeam(ts)
        setCourses(courseData?.courses || [])
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [id])

  useEffect(() => { load() }, [load])

  const save = async (data: Partial<Certification>) => {
    const url = data.id ? `/api/training/${data.id}` : '/api/training'
    const payload = { ...data, memberId: data.memberId ?? id }
    const res = await fetch(url, {
      method: data.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error || 'Save failed')
    }
    setDialogOpen(false)
    setEditing(null)
    load()
    setToast({ msg: data.id ? 'Qualification updated' : 'Qualification added' })
  }

  const remove = async (certId: string) => {
    const res = await fetch(`/api/training/${certId}`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error || 'Delete failed')
    }
    load()
    setToast({ msg: 'Qualification removed' })
  }

  if (loading) return <Loading />
  if (error || !member) return <ErrorView msg={error || 'Not found'} />

  const totalHours = member.timeEntries.reduce((s, e) => s + e.hours, 0)
  const approvedHours = member.timeEntries.filter(e => e.approved).reduce((s, e) => s + e.hours, 0)
  const certs = member.certifications.map(c => ({ ...c, statusBucket: bucket(c.expiryDate) }))

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      <div style={{ padding: '20px 20px 0 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)' }}>
        <Link href="/team" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 12 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>Team</span>
        </Link>
      </div>

      {/* Profile header */}
      <div style={{ padding: '0 20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Avatar name={member.name} color={member.avatarColor} size={72} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: 'var(--font-system)', fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4 }}>
            {member.name}
          </h1>
          <p style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#8ea8c5', marginTop: 2 }}>{member.role}</p>
          {member.onSite && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 11, fontWeight: 700, background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '3px 8px', borderRadius: 6 }}>
              <IcPin size={11} color="#10b981" /> On site
            </span>
          )}
        </div>
      </div>

      {/* Contact */}
      {(member.email || member.phone) && (
        <Section title="Contact">
          {member.email && <Row label="Email" value={member.email} href={`mailto:${member.email}`} />}
          {member.phone && <Row label="Phone" value={member.phone} href={`tel:${member.phone}`} />}
        </Section>
      )}

      {/* Stats */}
      <div style={{ padding: '0 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        <Stat label="Daily rate" value={`£${member.dailyRate.toLocaleString()}`} />
        <Stat label="Hours" value={`${totalHours}h`} />
        <Stat label="Approved" value={`${approvedHours}h`} />
      </div>

      {/* Qualifications */}
      <Section
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Qualifications & training ({certs.length})</span>
            <button
              onClick={() => { setEditing(null); setDialogOpen(true) }}
              style={{ background: 'rgba(245,158,11,0.18)', border: 'none', borderRadius: 6, padding: '4px 8px', color: '#f59e0b', fontFamily: 'var(--font-system)', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <IcPlus size={12} color="#f59e0b" /> Add
            </button>
          </div>
        }
      >
        {certs.length === 0 ? (
          <Empty msg="No qualifications recorded" />
        ) : (
          certs.map(c => (
            <div key={c.id} style={{ ...cardStyle, justifyContent: 'space-between' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ fontFamily: 'var(--font-system)', fontSize: 14, fontWeight: 600, color: '#eef3fa' }}>{c.type}</div>
                  <span style={{ padding: '2px 7px', borderRadius: 99, background: 'rgba(255,255,255,0.08)', color: '#8ea8c5', fontFamily: 'var(--font-system)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>{c.category}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-system)', fontSize: 12, color: '#8ea8c5', marginTop: 2 }}>
                  {c.number ? `#${c.number} · ` : ''}
                  {c.course && <span>{c.course.name} · </span>}
                  {c.expiryDate ? `expires ${new Date(c.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'No expiry'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <StatusBadge status={c.statusBucket || 'no_expiry'} />
                <button
                  onClick={() => { setEditing(c); setDialogOpen(true) }}
                  aria-label="Edit qualification"
                  style={{ background: 'none', border: 'none', borderRadius: 4, padding: 4, cursor: 'pointer' }}
                >
                  <IcEdit size={14} color="#8ea8c5" />
                </button>
              </div>
            </div>
          ))
        )}
      </Section>

      {/* Projects */}
      <Section title={`Assignments (${member.assignments.length})`}>
        {member.assignments.length === 0 ? (
          <Empty msg="Not on any active projects" />
        ) : (
          member.assignments.map(a => (
            <Link key={a.id} href={`/projects/${a.project.id}`} style={{ ...cardStyle, textDecoration: 'none' }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: statusColor[a.project.status] || '#52749a' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={cardTitle}>{a.project.name}</div>
                <div style={cardSub}>{a.role || 'Member'}{a.onSite ? ' · on site' : ''}</div>
              </div>
            </Link>
          ))
        )}
      </Section>

      {/* Recent time */}
      <Section title="Recent time entries">
        {member.timeEntries.length === 0 ? (
          <Empty msg="No time logged" />
        ) : (
          member.timeEntries.slice(0, 8).map(e => (
            <div key={e.id} style={cardStyle}>
              <IcClock size={14} color={e.approved ? '#10b981' : '#f59e0b'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={cardTitle}>{new Date(e.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                <div style={cardSub}>{e.project?.name || 'No project'}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 700, color: '#eef3fa' }}>{e.hours}h</span>
                {e.approved && <IcCheck size={12} color="#10b981" />}
              </div>
            </div>
          ))
        )}
      </Section>

      <TabBar />

      <CertificationDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null) }}
        onSave={save}
        onDelete={editing ? async () => { await remove(editing.id); setDialogOpen(false); setEditing(null) } : undefined}
        initial={editing}
        team={team}
        courses={courses}
        defaultMemberId={id}
        title={editing ? 'Edit qualification' : 'Add qualification'}
      />
    </div>
  )
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ padding: '0 20px 16px' }}>
      <p style={{ fontFamily: 'var(--font-system)', fontSize: 11, fontWeight: 700, color: '#52749a', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </section>
  )
}

function Row({ label, value, href }: { label: string; value: string; href?: string }) {
  const content = (
    <div style={{ ...cardStyle, gap: 12 }}>
      <div style={{ width: 80, fontFamily: 'var(--font-system)', fontSize: 12, color: '#52749a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ flex: 1, fontFamily: 'var(--font-system)', fontSize: 14, color: '#eef3fa' }}>{value}</div>
    </div>
  )
  return href ? <a href={href} style={{ textDecoration: 'none' }}>{content}</a> : content
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#152641', borderRadius: 12, padding: 12, border: '0.5px solid rgba(255,255,255,0.07)' }}>
      <div style={{ fontFamily: 'var(--font-system)', fontSize: 10, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 18, fontWeight: 700, color: '#eef3fa', marginTop: 4 }}>{value}</div>
    </div>
  )
}

function Empty({ msg }: { msg: string }) {
  return <div style={{ padding: '20px 0', textAlign: 'center', color: '#52749a', fontFamily: 'var(--font-system)', fontSize: 13 }}>{msg}</div>
}

function Loading() {
  return <div style={{ background: '#06101e', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#52749a', fontFamily: 'var(--font-system)' }}>Loading…</div>
}

function ErrorView({ msg }: { msg: string }) {
  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
      <div style={{ color: '#ef4444', fontFamily: 'var(--font-system)', fontSize: 16 }}>{msg}</div>
      <Link href="/team" style={{ color: '#f59e0b', fontFamily: 'var(--font-system)', fontSize: 14 }}>← Back to team</Link>
    </div>
  )
}

function StatusBadge({ status }: { status: Certification['statusBucket'] }) {
  const color =
    status === 'valid' ? '#10b981' :
    status === 'expiring' ? '#f59e0b' :
    status === 'expired' ? '#ef4444' : '#52749a'
  const label =
    status === 'valid' ? 'Valid' :
    status === 'expiring' ? 'Expiring' :
    status === 'expired' ? 'Expired' : 'No expiry'
  return (
    <span style={{ padding: '3px 9px', borderRadius: 99, background: `${color}22`, color, fontFamily: 'var(--font-system)', fontSize: 10, fontWeight: 700, border: `1px solid ${color}55`, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {label}
    </span>
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
}
const cardTitle: React.CSSProperties = {
  fontFamily: 'var(--font-system)',
  fontSize: 14,
  color: '#eef3fa',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}
const cardSub: React.CSSProperties = {
  fontFamily: 'var(--font-system)',
  fontSize: 12,
  color: '#8ea8c5',
  marginTop: 1,
}
