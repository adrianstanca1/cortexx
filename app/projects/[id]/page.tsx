'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Avatar from '@/components/ui/Avatar'
import Toast from '@/components/ui/Toast'
import { IcChevL, IcCheck, IcClock, IcDoc, IcPlus, IcX, IcTrash, IcEdit } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'
import type { Project, Task, Invoice, TeamMember } from '@/lib/types'

const statusColor: Record<string, string> = { active: '#10b981', snagging: '#f59e0b', quoting: '#8b5cf6', complete: '#52749a' }
const statusLabel: Record<string, string> = { active: 'Active', snagging: 'Snagging', quoting: 'Quoting', complete: 'Complete' }
const priorityColor: Record<string, string> = { critical: '#ef4444', high: '#f59e0b', medium: '#2563eb', low: '#52749a' }
const invoiceStatusColor: Record<string, string> = { draft: '#52749a', sent: '#f59e0b', paid: '#10b981', overdue: '#ef4444' }
const invoiceNextStatus: Record<string, string> = { draft: 'sent', sent: 'paid', paid: 'draft', overdue: 'paid' }

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
const STATUSES = ['active', 'quoting', 'snagging', 'complete'] as const
const DOCUMENT_EXPIRY_WARNING_DAYS = 7

type TabId = 'overview' | 'tasks' | 'team' | 'finance'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [allTeam, setAllTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('overview')
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)

  // Task modal
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [savingTask, setSavingTask] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'medium', dueDate: '', assigneeId: '' })

  // Invoice modal
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [savingInvoice, setSavingInvoice] = useState(false)
  const [invoiceForm, setInvoiceForm] = useState({ number: '', clientName: '', amount: '', dueDate: '', status: 'draft' })

  // Edit project modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editForm, setEditForm] = useState({ status: '', progress: '', budget: '', name: '', clientName: '', startDate: '', endDate: '' })
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(false)

  // Edit invoice modal
  const [showEditInvoiceModal, setShowEditInvoiceModal] = useState(false)
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null)
  const [editInvoiceForm, setEditInvoiceForm] = useState({ amount: '', dueDate: '', clientName: '', notes: '' })
  const [savingEditInvoice, setSavingEditInvoice] = useState(false)

  // Document modal
  const [showDocModal, setShowDocModal] = useState(false)
  const [savingDoc, setSavingDoc] = useState(false)
  const [docForm, setDocForm] = useState({ name: '', type: 'rams', expiresAt: '' })

  // Assign team modal
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [savingAssign, setSavingAssign] = useState(false)
  const [assignForm, setAssignForm] = useState({ memberId: '', role: '' })

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type })

  useModalEffects(showTaskModal, () => setShowTaskModal(false))
  useModalEffects(showInvoiceModal, () => setShowInvoiceModal(false))
  useModalEffects(showEditModal, () => setShowEditModal(false))
  useModalEffects(showEditInvoiceModal, () => { setShowEditInvoiceModal(false); setEditInvoice(null) })
  useModalEffects(showDocModal, () => setShowDocModal(false))
  useModalEffects(showAssignModal, () => setShowAssignModal(false))

  const logActivity = async (action: string, iconType = 'check') => {
    try {
      await fetch('/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id, actorName: 'You', actorType: 'human', action, iconType }),
      })
    } catch { /* non-critical */ }
  }

  const load = useCallback(() => {
    if (!id) { setLoading(false); setError('Invalid project ID'); return }
    fetch(`/api/projects/${id}`)
      .then(r => { if (!r.ok) throw new Error('Project not found'); return r.json() })
      .then(d => { setProject(d.project || d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ background: '#06101e', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#52749a', fontFamily: 'var(--font-system)' }}>Loading…</div>
  if (error || !project) return (
    <div style={{ background: '#06101e', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <div style={{ color: '#ef4444', fontFamily: 'var(--font-system)', fontSize: 16 }}>{error || 'Project not found'}</div>
      <Link href="/projects" style={{ color: '#f59e0b', fontFamily: 'var(--font-system)', fontSize: 14 }}>← Back to projects</Link>
    </div>
  )

  const sc = statusColor[project.status] || '#52749a'
  const margin = project.budget > 0 ? Math.round(((project.budget - project.spent) / project.budget) * 100) : 0
  const openTasks = project.tasks?.filter(t => t.status !== 'done') || []
  const doneTasks = project.tasks?.filter(t => t.status === 'done') || []
  const totalInvoiced = project.invoices?.reduce((s, i) => s + i.amount, 0) || 0
  const paid = project.invoices?.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0) || 0
  const daysLeft = project.endDate ? Math.ceil((new Date(project.endDate).getTime() - Date.now()) / 86400000) : null

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: `Tasks (${openTasks.length})` },
    { id: 'team', label: `Team (${project.assignments?.length || 0})` },
    { id: 'finance', label: 'Finance' },
  ]

  // Assigned member IDs for filtering
  const assignedIds = new Set(project.assignments?.map(a => a.memberId) || [])
  const availableTeam = allTeam.filter(m => !assignedIds.has(m.id))

  const toggleTask = async (task: Task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      setProject(prev => {
        if (!prev) return prev
        const updatedTasks = prev.tasks?.map(t => t.id === task.id ? { ...t, status: newStatus } : t) || []
        const total = updatedTasks.length
        const done = updatedTasks.filter(t => t.status === 'done').length
        const progress = total > 0 ? Math.round((done / total) * 100) : prev.progress
        return { ...prev, tasks: updatedTasks, progress }
      })
      if (newStatus === 'done') logActivity(`completed: ${task.title}`, 'check')
    } catch { showToast('Failed to update task', 'error') }
  }

  const createTask = async () => {
    if (!taskForm.title.trim()) return
    setSavingTask(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskForm.title.trim(),
          description: taskForm.description.trim() || null,
          priority: taskForm.priority,
          dueDate: taskForm.dueDate || null,
          assigneeId: taskForm.assigneeId || null,
          projectId: id,
          status: 'todo',
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const newTask = await res.json()
      setProject(prev => prev ? { ...prev, tasks: [...(prev.tasks || []), newTask] } : prev)
      setShowTaskModal(false)
      setTaskForm({ title: '', description: '', priority: 'medium', dueDate: '', assigneeId: '' })
      showToast('Task created')
      logActivity(`added task: ${taskForm.title.trim()}`, 'check')
    } catch { showToast('Failed to create task', 'error') }
    finally { setSavingTask(false) }
  }

  const cycleInvoiceStatus = async (inv: Invoice) => {
    const next = invoiceNextStatus[inv.status] || 'sent'
    try {
      const res = await fetch(`/api/invoices/${inv.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error('Failed')
      setProject(prev => {
        if (!prev) return prev
        const updatedInvoices = prev.invoices?.map(i => i.id === inv.id ? { ...i, status: next } : i) || []
        const newSpent = updatedInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
        return { ...prev, invoices: updatedInvoices, spent: newSpent }
      })
      showToast(`Invoice marked ${next}`)
      if (next === 'paid') logActivity(`marked invoice ${inv.number} as paid`, 'check')
    } catch { showToast('Failed to update invoice', 'error') }
  }

  const deleteInvoice = async (inv: Invoice) => {
    try {
      const res = await fetch(`/api/invoices/${inv.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setProject(prev => {
        if (!prev) return prev
        const updatedInvoices = prev.invoices?.filter(i => i.id !== inv.id) || []
        const newSpent = updatedInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
        return { ...prev, invoices: updatedInvoices, spent: newSpent }
      })
      showToast('Invoice deleted')
    } catch { showToast('Failed to delete invoice', 'error') }
  }

  const openEditInvoice = (inv: Invoice) => {
    setEditInvoice(inv)
    setEditInvoiceForm({
      amount: inv.amount.toString(),
      dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().split('T')[0] : '',
      clientName: inv.clientName || '',
      notes: inv.notes || '',
    })
    setShowEditInvoiceModal(true)
  }

  const saveEditInvoice = async () => {
    if (!editInvoice) return
    const amt = parseFloat(editInvoiceForm.amount)
    if (isNaN(amt) || amt <= 0) {
      showToast('Amount must be a positive number', 'error')
      return
    }
    setSavingEditInvoice(true)
    try {
      const res = await fetch(`/api/invoices/${editInvoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          dueDate: editInvoiceForm.dueDate || null,
          clientName: editInvoiceForm.clientName || null,
          notes: editInvoiceForm.notes || null,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed')
      }
      const updated = await res.json()
      setProject(prev => {
        if (!prev) return prev
        const updatedInvoices = prev.invoices?.map(i => i.id === updated.id ? { ...i, ...updated } : i) || []
        const newSpent = updatedInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
        return { ...prev, invoices: updatedInvoices, spent: newSpent }
      })
      setShowEditInvoiceModal(false)
      setEditInvoice(null)
      showToast('Invoice updated')
    } catch (e) { showToast(e instanceof Error ? e.message : 'Failed to update invoice', 'error') }
    finally { setSavingEditInvoice(false) }
  }

  const createInvoice = async () => {
    if (!invoiceForm.number.trim() || !invoiceForm.amount || !invoiceForm.dueDate) return
    const amt = parseFloat(invoiceForm.amount)
    if (isNaN(amt) || amt <= 0) {
      showToast('Amount must be a positive number', 'error')
      return
    }
    setSavingInvoice(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: invoiceForm.number.trim(),
          clientName: invoiceForm.clientName.trim() || project.clientName,
          amount: amt,
          dueDate: invoiceForm.dueDate,
          status: invoiceForm.status,
          projectId: id,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed')
      }
      const newInvoice = await res.json()
      setProject(prev => prev ? { ...prev, invoices: [...(prev.invoices || []), newInvoice] } : prev)
      setShowInvoiceModal(false)
      setInvoiceForm({ number: '', clientName: '', amount: '', dueDate: '', status: 'draft' })
      showToast('Invoice created')
      logActivity(`created invoice ${invoiceForm.number.trim()}`, 'receipt')
    } catch (e) { showToast(e instanceof Error ? e.message : 'Failed to create invoice', 'error') }
    finally { setSavingInvoice(false) }
  }

  const saveEdit = async () => {
    setSavingEdit(true)
    try {
      const body: Record<string, string | number> = {}
      if (editForm.status) body.status = editForm.status
      if (editForm.progress !== '') body.progress = Math.max(0, Math.min(100, parseInt(editForm.progress) || 0))
      if (editForm.budget !== '') body.budget = Math.max(0, parseFloat(editForm.budget) || 0)
      if (editForm.name.trim()) body.name = editForm.name.trim()
      if (editForm.clientName.trim()) body.clientName = editForm.clientName.trim()
      if (editForm.startDate) body.startDate = editForm.startDate
      if (editForm.endDate) body.endDate = editForm.endDate
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed')
      const updated = await res.json()
      setProject(prev => prev ? { ...prev, ...updated } : prev)
      setShowEditModal(false)
      showToast('Project updated')
      if (body.status && body.status !== project.status) logActivity(`changed status to ${body.status}`, 'check')
    } catch { showToast('Failed to update project', 'error') }
    finally { setSavingEdit(false) }
  }

  const deleteProject = async () => {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      router.push('/projects')
    } catch { showToast('Failed to delete project', 'error') }
  }

  const createDocument = async () => {
    if (!docForm.name.trim()) return
    setSavingDoc(true)
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: docForm.name.trim(),
          type: docForm.type,
          projectId: id,
          expiresAt: docForm.expiresAt || null,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const newDoc = await res.json()
      setProject(prev => prev ? { ...prev, documents: [newDoc, ...(prev.documents || [])] } : prev)
      setShowDocModal(false)
      setDocForm({ name: '', type: 'rams', expiresAt: '' })
      showToast('Document added')
    } catch { showToast('Failed to add document', 'error') }
    finally { setSavingDoc(false) }
  }

  const deleteDocument = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setProject(prev => prev ? { ...prev, documents: (prev.documents || []).filter(d => d.id !== docId) } : prev)
      showToast('Document removed')
    } catch { showToast('Failed to remove document', 'error') }
  }

  const openAssignModal = () => {
    setShowAssignModal(true)
    setAssignForm({ memberId: '', role: '' })
    fetch('/api/team')
      .then(r => r.json())
      .then(d => setAllTeam(d.team || []))
      .catch(() => {})
  }

  const assignMember = async () => {
    if (!assignForm.memberId) return
    setSavingAssign(true)
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id, memberId: assignForm.memberId, role: assignForm.role || null }),
      })
      if (!res.ok) throw new Error('Failed')
      const newAssignment = await res.json()
      setProject(prev => prev ? { ...prev, assignments: [...(prev.assignments || []), newAssignment] } : prev)
      setShowAssignModal(false)
      showToast(`${newAssignment.member?.name} assigned`)
      logActivity(`assigned ${newAssignment.member?.name} to project`, 'hardhat')
    } catch { showToast('Failed to assign team member', 'error') }
    finally { setSavingAssign(false) }
  }

  const removeAssignment = async (assignmentId: string, memberName: string) => {
    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setProject(prev => prev ? { ...prev, assignments: prev.assignments?.filter(a => a.id !== assignmentId) } : prev)
      showToast(`${memberName} removed`)
    } catch { showToast('Failed to remove team member', 'error') }
  }

  const toggleAssignmentOnSite = async (assignmentId: string, currentOnSite: boolean) => {
    // Optimistic update with rollback on failure
    setProject(prev => {
      if (!prev) return prev
      const updatedAssignments = prev.assignments?.map(a => a.id === assignmentId ? { ...a, onSite: !currentOnSite } : a) || []
      return { ...prev, assignments: updatedAssignments, onSiteCount: updatedAssignments.filter(a => a.onSite).length }
    })
    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onSite: !currentOnSite }),
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      // Rollback on failure
      setProject(prev => {
        if (!prev) return prev
        const rolledBack = prev.assignments?.map(a => a.id === assignmentId ? { ...a, onSite: currentOnSite } : a) || []
        return { ...prev, assignments: rolledBack, onSiteCount: rolledBack.filter(a => a.onSite).length }
      })
      showToast('Failed to update on-site status', 'error')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: '11px 14px', color: '#eef3fa',
    fontFamily: 'var(--font-system)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6,
  }

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      {/* Header */}
      <div style={{ padding: '20px 20px 0', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)', paddingBottom: 12 }}>
        <Link href="/projects" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>Projects</span>
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-system)', fontSize: 10, fontWeight: 700, background: `${sc}22`, color: sc, padding: '2px 7px', borderRadius: 5 }}>{statusLabel[project.status] || project.status}</span>
              {daysLeft !== null && daysLeft <= 14 && daysLeft >= 0 && (
                <span style={{ fontFamily: 'var(--font-system)', fontSize: 10, fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '2px 7px', borderRadius: 5 }}>{daysLeft}d left</span>
              )}
              {daysLeft !== null && daysLeft < 0 && (
                <span style={{ fontFamily: 'var(--font-system)', fontSize: 10, fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '2px 7px', borderRadius: 5 }}>OVERDUE</span>
              )}
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.3, fontFamily: 'var(--font-system)' }}>{project.name}</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: 'var(--font-system)' }}>{project.clientName}{project.postcode ? ` · ${project.postcode}` : ''}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => { setEditForm({ status: project.status, progress: project.progress.toString(), budget: project.budget.toString(), name: project.name, clientName: project.clientName, startDate: project.startDate?.split('T')[0] || '', endDate: project.endDate?.split('T')[0] || '' }); setConfirmDeleteProject(false); setShowEditModal(true) }} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.1)', color: '#8ea8c5', fontFamily: 'var(--font-system)', fontSize: 12, cursor: 'pointer' }}>Edit</button>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 28, fontWeight: 700, color: sc }}>{project.progress}<span style={{ fontSize: 14, color: '#52749a' }}>%</span></div>
          </div>
        </div>
        <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden', marginTop: 10 }}>
          <div style={{ width: `${project.progress}%`, height: '100%', background: sc, borderRadius: 2, transition: 'width 0.3s ease' }} />
        </div>
        <div style={{ display: 'flex', gap: 0, marginTop: 12, overflowX: 'auto' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: '8px 4px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-system)', fontSize: 13, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? '#f59e0b' : '#52749a', borderBottom: `2px solid ${tab === t.id ? '#f59e0b' : 'transparent'}`, whiteSpace: 'nowrap' }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div>
            <InfoCard label="Client" value={project.clientName || '—'} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
              <StatCard label="Budget" value={project.budget > 0 ? `£${(project.budget/1000).toFixed(0)}k` : '—'} sub="total" color="#eef3fa" />
              <StatCard label="Spent" value={project.budget > 0 ? `£${(project.spent/1000).toFixed(0)}k` : '—'} sub={project.budget > 0 ? `${Math.round(project.spent/project.budget*100)}% used` : '—'} color="#f59e0b" />
              <StatCard label="Margin" value={project.budget > 0 ? `${margin}%` : '—'} sub="remaining" color={margin > 20 ? '#10b981' : margin > 10 ? '#f59e0b' : '#ef4444'} />
              <StatCard label="On site" value={project.onSiteCount.toString()} sub="today" color="#2563eb" />
            </div>
            {(project.startDate || project.endDate) && (
              <div style={{ marginTop: 12, background: '#152641', borderRadius: 12, padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'flex', gap: 24 }}>
                  {project.startDate && <div><div style={labelStyle}>Started</div><div style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#eef3fa' }}>{new Date(project.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</div></div>}
                  {project.endDate && <div><div style={labelStyle}>Due</div><div style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: daysLeft !== null && daysLeft <= 7 ? '#ef4444' : '#eef3fa' }}>{new Date(project.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}{daysLeft !== null && <span style={{ color: '#52749a', fontSize: 11 }}> ({daysLeft > 0 ? `${daysLeft}d left` : daysLeft === 0 ? 'today' : 'overdue'})</span>}</div></div>}
                </div>
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <p style={{ ...labelStyle, marginBottom: 0 }}>Documents</p>
                <button onClick={() => setShowDocModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#f59e0b', fontFamily: 'var(--font-system)', fontSize: 12, cursor: 'pointer', padding: 0 }}>
                  <IcPlus size={12} color="#f59e0b" /> Add
                </button>
              </div>
              {project.documents && project.documents.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {project.documents.map(doc => {
                    const expiring = doc.expiresAt && new Date(doc.expiresAt) < new Date(Date.now() + DOCUMENT_EXPIRY_WARNING_DAYS * 86400000)
                    return (
                      <div key={doc.id} style={{ background: '#152641', borderRadius: 10, padding: '10px 12px', border: `0.5px solid ${expiring ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <IcDoc size={16} color={expiring ? '#ef4444' : '#52749a'} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#eef3fa' }}>{doc.name}</div>
                          {doc.expiresAt && <div style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: expiring ? '#ef4444' : '#52749a', marginTop: 1 }}>Expires {new Date(doc.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{expiring ? ' ⚠' : ''}</div>}
                        </div>
                        <span style={{ fontFamily: 'var(--font-system)', fontSize: 10, color: '#52749a', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4, textTransform: 'capitalize' }}>{doc.type}</span>
                        <button onClick={() => deleteDocument(doc.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0.5 }}>
                          <IcX size={12} color="#ef4444" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a', fontStyle: 'italic' }}>No documents yet</p>
              )}
            </div>
            {project.activities && project.activities.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p style={{ ...labelStyle, marginBottom: 8 }}>Recent activity</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {project.activities.slice(0, 5).map(act => (
                    <div key={act.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: '#152641', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 12 }}>
                          {act.iconType === 'camera' ? '📷' : act.iconType === 'mic' ? '🎙' : act.iconType === 'receipt' ? '🧾' : act.iconType === 'alert' ? '⚠️' : act.iconType === 'hardhat' ? '👷' : '✓'}
                        </span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontFamily: 'var(--font-system)', fontSize: 12, color: '#8ea8c5' }}><span style={{ color: '#eef3fa', fontWeight: 600 }}>{act.actorName}</span> {act.action}</span>
                      </div>
                      <span style={{ fontFamily: 'var(--font-system)', fontSize: 10, color: '#52749a', flexShrink: 0 }}>{new Date(act.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TASKS ── */}
        {tab === 'tasks' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>{openTasks.length} open · {doneTasks.length} done</span>
              <button onClick={() => setShowTaskModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <IcPlus size={14} color="#fff" /> Add task
              </button>
            </div>
            {openTasks.length === 0 && doneTasks.length === 0 && (
              <div style={{ textAlign: 'center', color: '#52749a', padding: '40px 0', fontFamily: 'var(--font-system)', fontSize: 14 }}>No tasks yet — add one above</div>
            )}
            {openTasks.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ ...labelStyle, marginBottom: 8 }}>Open · {openTasks.length}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {openTasks.map(task => (
                    <div key={task.id} onClick={() => toggleTask(task)} style={{ background: '#152641', borderRadius: 12, padding: '12px 14px', border: `0.5px solid ${task.priority === 'critical' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`, display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                      <div style={{ width: 22, height: 22, borderRadius: 7, background: `${priorityColor[task.priority] || '#52749a'}22`, border: `1.5px solid ${priorityColor[task.priority] || '#52749a'}`, flexShrink: 0, marginTop: 1 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-system)', fontSize: 14, fontWeight: 600, color: '#eef3fa' }}>{task.title}</div>
                        {task.description && <div style={{ fontFamily: 'var(--font-system)', fontSize: 12, color: '#52749a', marginTop: 2, lineHeight: 1.4 }}>{task.description}</div>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                          <span style={{ fontFamily: 'var(--font-system)', fontSize: 10, fontWeight: 700, color: priorityColor[task.priority] || '#52749a', textTransform: 'capitalize' }}>{task.priority}</span>
                          {task.dueDate && <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IcClock size={10} color="#52749a" /><span style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a' }}>{new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></div>}
                        </div>
                      </div>
                      {task.assignee && <Avatar name={task.assignee.name} color={task.assignee.avatarColor} size={24} />}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {doneTasks.length > 0 && (
              <div>
                <p style={{ ...labelStyle, marginBottom: 8 }}>Done · {doneTasks.length}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {doneTasks.map(task => (
                    <div key={task.id} onClick={() => toggleTask(task)} style={{ background: '#152641', borderRadius: 12, padding: '10px 14px', border: '0.5px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 10, opacity: 0.5, cursor: 'pointer' }}>
                      <IcCheck size={14} color="#10b981" />
                      <div style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#8ea8c5', textDecoration: 'line-through' }}>{task.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TEAM ── */}
        {tab === 'team' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>{project.assignments?.length || 0} assigned</span>
              <button onClick={openAssignModal} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: '#2563eb', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <IcPlus size={14} color="#fff" /> Add member
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {project.assignments?.length === 0 && <div style={{ textAlign: 'center', color: '#52749a', padding: '40px 0', fontFamily: 'var(--font-system)', fontSize: 14 }}>No team assigned yet</div>}
              {project.assignments?.map(a => (
                <div key={a.id} style={{ background: '#152641', borderRadius: 14, padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ position: 'relative' }}>
                    <Avatar name={a.member?.name || '?'} color={a.member?.avatarColor || '#2563eb'} size={40} />
                    {a.onSite && <div style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: 5, background: '#10b981', border: '1.5px solid #06101e' }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-system)', fontSize: 15, fontWeight: 600, color: '#eef3fa' }}>{a.member?.name}</div>
                    <div style={{ fontFamily: 'var(--font-system)', fontSize: 12, color: '#8ea8c5', marginTop: 1 }}>{a.role || a.member?.role}</div>
                  </div>
                  <button onClick={() => toggleAssignmentOnSite(a.id, a.onSite)} style={{ fontFamily: 'var(--font-system)', fontSize: 10, fontWeight: 700, color: a.onSite ? '#10b981' : '#52749a', background: a.onSite ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${a.onSite ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`, padding: '4px 8px', borderRadius: 6, cursor: 'pointer' }}>
                    {a.onSite ? '● ON SITE' : 'OFF SITE'}
                  </button>
                  <button onClick={() => removeAssignment(a.id, a.member?.name || 'member')} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <IcX size={12} color="#ef4444" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FINANCE ── */}
        {tab === 'finance' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '0.5px solid rgba(16,185,129,0.2)', borderRadius: 14, padding: 12 }}>
                <div style={{ fontFamily: 'var(--font-system)', fontSize: 10, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Invoiced</div>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 22, fontWeight: 700, color: '#eef3fa' }}>£{(totalInvoiced/1000).toFixed(1)}k</div>
                <div style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#8ea8c5', marginTop: 1 }}>{project.invoices?.length || 0} invoices</div>
              </div>
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '0.5px solid rgba(16,185,129,0.2)', borderRadius: 14, padding: 12 }}>
                <div style={{ fontFamily: 'var(--font-system)', fontSize: 10, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Collected</div>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 22, fontWeight: 700, color: '#eef3fa' }}>£{(paid/1000).toFixed(1)}k</div>
                <div style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#8ea8c5', marginTop: 1 }}>{project.invoices?.filter(i => i.status === 'paid').length || 0} paid</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p style={{ ...labelStyle, marginBottom: 0 }}>Invoices</p>
              <button onClick={() => {
                const nextNum = (project.invoices?.length || 0) + 1
                setInvoiceForm({ number: `INV-${String(nextNum).padStart(3, '0')}`, clientName: project.clientName, amount: '', dueDate: '', status: 'draft' })
                setShowInvoiceModal(true)
              }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <IcPlus size={12} color="#fff" /> Add invoice
              </button>
            </div>

            {(!project.invoices || project.invoices.length === 0) && (
              <div style={{ textAlign: 'center', color: '#52749a', padding: '30px 0', fontFamily: 'var(--font-system)', fontSize: 14 }}>No invoices yet</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {project.invoices?.map(inv => {
                const ic = invoiceStatusColor[inv.status] || '#52749a'
                return (
                  <div key={inv.id} style={{ background: '#152641', borderRadius: 10, padding: '10px 12px', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div onClick={() => cycleInvoiceStatus(inv)} style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: ic, flexShrink: 0, cursor: 'pointer' }} />
                    <div onClick={() => cycleInvoiceStatus(inv)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#8ea8c5' }}>{inv.number}</div>
                      <div style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#eef3fa', fontWeight: 500, marginTop: 1 }}>{inv.clientName}</div>
                    </div>
                    <div onClick={() => cycleInvoiceStatus(inv)} style={{ textAlign: 'right', cursor: 'pointer' }}>
                      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14, color: ic, fontWeight: 700 }}>£{inv.amount.toLocaleString()}</div>
                      <div style={{ fontFamily: 'var(--font-system)', fontSize: 10, color: ic, marginTop: 1, textTransform: 'capitalize', fontWeight: 600 }}>{inv.status} →</div>
                    </div>
                    <button onClick={() => openEditInvoice(inv)} style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                      <IcEdit size={12} color="#f59e0b" />
                    </button>
                    <button onClick={() => deleteInvoice(inv)} style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                      <IcTrash size={12} color="#ef4444" />
                    </button>
                  </div>
                )
              })}
            </div>
            {project.invoices && project.invoices.length > 0 && (
              <p style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', textAlign: 'center', marginTop: 8 }}>Tap an invoice to advance its status</p>
            )}
          </div>
        )}
      </div>

      <TabBar />

      {/* ── ADD TASK MODAL ── */}
      {showTaskModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowTaskModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-system)', fontSize: 18, fontWeight: 700, color: '#eef3fa' }}>Add task</h3>
              <button onClick={() => setShowTaskModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /><span style={{ position: 'absolute', clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', height: 1, overflow: 'hidden', whiteSpace: 'nowrap', width: 1 }}>Close</span></button>
            </div>
            <div>
              <label style={labelStyle}>Title *</label>
              <input autoFocus value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Install kitchen units" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <input value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional details" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Priority</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {PRIORITIES.map(p => (
                  <button key={p} onClick={() => setTaskForm(prev => ({ ...prev, priority: p }))} style={{ flex: 1, padding: '8px 4px', borderRadius: 10, background: taskForm.priority === p ? `${priorityColor[p]}22` : 'rgba(255,255,255,0.05)', border: `1px solid ${taskForm.priority === p ? priorityColor[p] : 'rgba(255,255,255,0.1)'}`, color: taskForm.priority === p ? priorityColor[p] : '#8ea8c5', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-system)', textTransform: 'capitalize' }}>{p}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Due date</label>
              <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm(p => ({ ...p, dueDate: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>
            <div>
              <label style={labelStyle}>Assignee</label>
              <select value={taskForm.assigneeId} onChange={e => setTaskForm(p => ({ ...p, assigneeId: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                <option value="">Unassigned</option>
                {project.assignments?.map(a => a.member && <option key={a.member.id} value={a.member.id}>{a.member.name}</option>)}
              </select>
            </div>
            <button onClick={createTask} disabled={savingTask || !taskForm.title.trim()} style={{ padding: '14px 0', borderRadius: 14, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: savingTask || !taskForm.title.trim() ? 0.5 : 1 }}>
              {savingTask ? 'Adding…' : 'Add task'}
            </button>
          </div>
        </div>
      )}

      {/* ── ADD INVOICE MODAL ── */}
      {showInvoiceModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowInvoiceModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-system)', fontSize: 18, fontWeight: 700, color: '#eef3fa' }}>New invoice</h3>
              <button onClick={() => setShowInvoiceModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /><span style={{ position: 'absolute', clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', height: 1, overflow: 'hidden', whiteSpace: 'nowrap', width: 1 }}>Close</span></button>
            </div>
            {[
              { key: 'number', label: 'Invoice number *', placeholder: 'INV-001' },
              { key: 'clientName', label: 'Client name', placeholder: project.clientName },
              { key: 'amount', label: 'Amount (£) *', placeholder: '5000', type: 'number', min: '0' },
            ].map(f => (
              <div key={f.key}>
                <label style={labelStyle}>{f.label}</label>
                <input value={invoiceForm[f.key as keyof typeof invoiceForm]} onChange={e => setInvoiceForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} type={(f as { type?: string }).type || 'text'} min={(f as { min?: string }).min} style={inputStyle} />
              </div>
            ))}
            <div>
              <label style={labelStyle}>Due date *</label>
              <input type="date" value={invoiceForm.dueDate} onChange={e => setInvoiceForm(p => ({ ...p, dueDate: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['draft', 'sent', 'paid'] as const).map(s => (
                  <button key={s} onClick={() => setInvoiceForm(p => ({ ...p, status: s }))} style={{ flex: 1, padding: '8px 4px', borderRadius: 10, background: invoiceForm.status === s ? `${invoiceStatusColor[s]}22` : 'rgba(255,255,255,0.05)', border: `1px solid ${invoiceForm.status === s ? invoiceStatusColor[s] : 'rgba(255,255,255,0.1)'}`, color: invoiceForm.status === s ? invoiceStatusColor[s] : '#8ea8c5', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-system)', textTransform: 'capitalize' }}>{s}</button>
                ))}
              </div>
            </div>
            <button onClick={createInvoice} disabled={savingInvoice || !invoiceForm.number.trim() || !invoiceForm.amount || !invoiceForm.dueDate} style={{ padding: '14px 0', borderRadius: 14, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: savingInvoice || !invoiceForm.number.trim() || !invoiceForm.amount || !invoiceForm.dueDate ? 0.5 : 1 }}>
              {savingInvoice ? 'Creating…' : 'Create invoice'}
            </button>
          </div>
        </div>
      )}

      {/* ── EDIT PROJECT MODAL ── */}
      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowEditModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-system)', fontSize: 18, fontWeight: 700, color: '#eef3fa' }}>Edit project</h3>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /><span style={{ position: 'absolute', clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', height: 1, overflow: 'hidden', whiteSpace: 'nowrap', width: 1 }}>Close</span></button>
            </div>
            <div>
              <label style={labelStyle}>Project name</label>
              <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Client name</label>
              <input value={editForm.clientName} onChange={e => setEditForm(p => ({ ...p, clientName: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {STATUSES.map(s => (
                  <button key={s} onClick={() => setEditForm(p => ({ ...p, status: s }))} style={{ flex: 1, padding: '8px 4px', borderRadius: 10, background: editForm.status === s ? `${statusColor[s]}22` : 'rgba(255,255,255,0.05)', border: `1px solid ${editForm.status === s ? statusColor[s] : 'rgba(255,255,255,0.1)'}`, color: editForm.status === s ? statusColor[s] : '#8ea8c5', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-system)', textTransform: 'capitalize' }}>{statusLabel[s]}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Progress (%)</label>
              <input type="number" min="0" max="100" value={editForm.progress} onChange={e => setEditForm(p => ({ ...p, progress: e.target.value }))} placeholder="0–100" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Budget (£)</label>
              <input type="number" min="0" value={editForm.budget} onChange={e => setEditForm(p => ({ ...p, budget: e.target.value }))} placeholder="85000" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Start date</label>
              <input type="date" value={editForm.startDate} onChange={e => setEditForm(p => ({ ...p, startDate: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>
            <div>
              <label style={labelStyle}>End date</label>
              <input type="date" value={editForm.endDate} onChange={e => setEditForm(p => ({ ...p, endDate: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>
            <button onClick={saveEdit} disabled={savingEdit} style={{ padding: '14px 0', borderRadius: 14, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: savingEdit ? 0.5 : 1 }}>
              {savingEdit ? 'Saving…' : 'Save changes'}
            </button>
            {confirmDeleteProject ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmDeleteProject(false)} style={{ flex: 1, padding: '12px 0', borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#8ea8c5', fontFamily: 'var(--font-system)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button onClick={deleteProject} style={{ flex: 1, padding: '12px 0', borderRadius: 14, background: '#ef4444', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Delete project</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDeleteProject(true)} style={{ padding: '12px 0', borderRadius: 14, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontFamily: 'var(--font-system)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Delete project
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── ASSIGN TEAM MEMBER MODAL ── */}
      {showAssignModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowAssignModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '85dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-system)', fontSize: 18, fontWeight: 700, color: '#eef3fa' }}>Assign team member</h3>
              <button onClick={() => setShowAssignModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /><span style={{ position: 'absolute', clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', height: 1, overflow: 'hidden', whiteSpace: 'nowrap', width: 1 }}>Close</span></button>
            </div>
            {availableTeam.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-system)', fontSize: 14, color: '#52749a', textAlign: 'center', padding: '20px 0' }}>All team members are already assigned to this project.</p>
            ) : (
              <>
                <div>
                  <label style={labelStyle}>Team member *</label>
                  <select value={assignForm.memberId} onChange={e => setAssignForm(p => ({ ...p, memberId: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                    <option value="">Select a member</option>
                    {availableTeam.map(m => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Role on this project (optional)</label>
                  <input value={assignForm.role} onChange={e => setAssignForm(p => ({ ...p, role: e.target.value }))} placeholder={availableTeam.find(m => m.id === assignForm.memberId)?.role || 'e.g. Lead Electrician'} style={inputStyle} />
                </div>
                <button onClick={assignMember} disabled={savingAssign || !assignForm.memberId} style={{ padding: '14px 0', borderRadius: 14, background: '#2563eb', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: savingAssign || !assignForm.memberId ? 0.5 : 1 }}>
                  {savingAssign ? 'Assigning…' : 'Assign to project'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showEditInvoiceModal && editInvoice && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowEditInvoiceModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '85dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-system)', fontSize: 18, fontWeight: 700, color: '#eef3fa' }}>Edit {editInvoice.number}</h3>
              <button onClick={() => setShowEditInvoiceModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /><span style={{ position: 'absolute', clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', height: 1, overflow: 'hidden', whiteSpace: 'nowrap', width: 1 }}>Close</span></button>
            </div>
            <div>
              <label style={labelStyle}>Amount (£) *</label>
              <input type="number" min="0" value={editInvoiceForm.amount} onChange={e => setEditInvoiceForm(p => ({ ...p, amount: e.target.value }))} placeholder="5000" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Client name</label>
              <input value={editInvoiceForm.clientName} onChange={e => setEditInvoiceForm(p => ({ ...p, clientName: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Due date</label>
              <input type="date" value={editInvoiceForm.dueDate} onChange={e => setEditInvoiceForm(p => ({ ...p, dueDate: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <input value={editInvoiceForm.notes} onChange={e => setEditInvoiceForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional" style={inputStyle} />
            </div>
            <button onClick={saveEditInvoice} disabled={savingEditInvoice || !editInvoiceForm.amount} style={{ padding: '14px 0', borderRadius: 14, background: '#2563eb', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: savingEditInvoice || !editInvoiceForm.amount ? 0.5 : 1 }}>
              {savingEditInvoice ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      {/* ── ADD DOCUMENT MODAL ── */}
      {showDocModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowDocModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '85dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-system)', fontSize: 18, fontWeight: 700, color: '#eef3fa' }}>Add document</h3>
              <button onClick={() => setShowDocModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /><span style={{ position: 'absolute', clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', height: 1, overflow: 'hidden', whiteSpace: 'nowrap', width: 1 }}>Close</span></button>
            </div>
            <div>
              <label style={labelStyle}>Document name *</label>
              <input autoFocus value={docForm.name} onChange={e => setDocForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. RAMS — Electrical Works" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['rams', 'report', 'photo', 'other'] as const).map(t => (
                  <button key={t} onClick={() => setDocForm(p => ({ ...p, type: t }))} style={{ flex: 1, padding: '8px 4px', borderRadius: 10, background: docForm.type === t ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${docForm.type === t ? '#f59e0b' : 'rgba(255,255,255,0.1)'}`, color: docForm.type === t ? '#f59e0b' : '#8ea8c5', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-system)', textTransform: 'capitalize' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Expiry date</label>
              <input type="date" value={docForm.expiresAt} onChange={e => setDocForm(p => ({ ...p, expiresAt: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>
            <button onClick={createDocument} disabled={savingDoc || !docForm.name.trim()} style={{ padding: '14px 0', borderRadius: 14, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: savingDoc || !docForm.name.trim() ? 0.5 : 1 }}>
              {savingDoc ? 'Adding…' : 'Add document'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#152641', borderRadius: 12, padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.07)', marginBottom: 8 }}>
      <div style={{ fontFamily: 'var(--font-system)', fontSize: 10, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-system)', fontSize: 15, color: '#eef3fa', marginTop: 4 }}>{value}</div>
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ background: '#152641', borderRadius: 12, padding: '12px 12px', border: '0.5px solid rgba(255,255,255,0.07)' }}>
      <div style={{ fontFamily: 'var(--font-system)', fontSize: 10, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 22, fontWeight: 700, color, marginTop: 4, letterSpacing: -0.5 }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', marginTop: 2 }}>{sub}</div>
    </div>
  )
}
