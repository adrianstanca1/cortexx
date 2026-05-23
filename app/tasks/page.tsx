'use client'

import { useState, useEffect } from 'react'
import TabBar from '@/components/ui/TabBar'
import MobileHeader from '@/components/ui/MobileHeader'
import Avatar from '@/components/ui/Avatar'
import Pill from '@/components/ui/Pill'
import { IcCheck, IcClock, IcPlus, IcX, IcSearch, IcTrash, IcEdit } from '@/components/ui/Icons'
import Toast from '@/components/ui/Toast'
import CommentsThread from '@/components/ui/CommentsThread'
import { useModalEffects } from '@/lib/useModalEffects'
import type { Task } from '@/lib/types'

// Semantic priority colors: critical=red, high=orange, medium=blue, low=gray
const priorityColor: Record<string, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#2563eb',
  low: '#52749a',
}

const priorityBg: Record<string, string> = {
  critical: 'rgba(239,68,68,0.10)',
  high: 'rgba(245,158,11,0.08)',
  medium: 'rgba(37,99,235,0.06)',
  low: 'rgba(82,116,154,0.06)',
}

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

const CATEGORIES = ['', 'Inspection', 'Admin', 'Safety', 'Finance', 'Construction', 'Electrical', 'Planning', 'Snagging', 'Plumbing', 'Other'] as const

const filters = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'done', label: 'Done' },
]

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [team, setTeam] = useState<{ id: string; name: string; avatarColor: string }[]>([])
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium', dueDate: '', dueTime: '', projectId: '', assigneeId: '', category: '',
  })
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [search, setSearch] = useState('')
  const [editTarget, setEditTarget] = useState<Task | null>(null)
  const [editForm, setEditForm] = useState({ title: '', description: '', priority: 'medium', dueDate: '', dueTime: '', projectId: '', assigneeId: '', category: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkSaving, setBulkSaving] = useState(false)

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const bulk = async (action: 'complete' | 'reopen' | 'delete') => {
    if (selectedIds.size === 0) return
    if (action === 'delete' && !window.confirm(`Delete ${selectedIds.size} task${selectedIds.size === 1 ? '' : 's'}?`)) return
    setBulkSaving(true)
    const ids = Array.from(selectedIds)
    try {
      const res = await fetch('/api/tasks/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      if (action === 'delete') {
        setTasks(prev => prev.filter(t => !ids.includes(t.id)))
      } else {
        const newStatus = action === 'complete' ? 'done' : 'todo'
        setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, status: newStatus } : t))
      }
      setToast({ msg: `${data.updated} task${data.updated === 1 ? '' : 's'} ${action === 'delete' ? 'deleted' : action === 'complete' ? 'completed' : 'reopened'}` })
      exitSelectMode()
    } catch {
      setToast({ msg: 'Bulk action failed', type: 'error' })
    } finally {
      setBulkSaving(false)
    }
  }

  useModalEffects(showModal, () => setShowModal(false))
  useModalEffects(!!editTarget, () => setEditTarget(null))

  useEffect(() => {
    fetch('/api/tasks')
      .then(r => {
        if (!r.ok) throw new Error('Failed to load tasks')
        return r.json()
      })
      .then((data) => {
        setTasks(data.tasks || [])
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new') === '1') {
      openModal()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openModal = () => {
    setShowModal(true)
    if (projects.length === 0) {
      fetch('/api/projects').then(r => r.json()).then(d => {
        const ps = d.projects || d
        setProjects(ps.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
      }).catch(() => {})
    }
    if (team.length === 0) {
      fetch('/api/team').then(r => r.json()).then(d => {
        setTeam((d.team || []).map((m: { id: string; name: string; avatarColor: string }) => ({ id: m.id, name: m.name, avatarColor: m.avatarColor })))
      }).catch(() => {})
    }
  }

  const createTask = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          priority: form.priority,
          dueDate: form.dueDate || null,
          dueTime: form.dueTime || null,
          projectId: form.projectId || null,
          assigneeId: form.assigneeId || null,
          category: form.category || null,
          status: 'todo',
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const newTask = await res.json()
      setTasks(prev => [newTask, ...prev])
      setShowModal(false)
      setForm({ title: '', description: '', priority: 'medium', dueDate: '', dueTime: '', projectId: '', assigneeId: '', category: '' })
      setToast({ msg: 'Task created' })
    } catch {
      setToast({ msg: 'Failed to create task', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const filtered = tasks.filter((t) => {
    const matchesSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.project?.name.toLowerCase() || '').includes(search.toLowerCase()) ||
      (t.assignee?.name.toLowerCase() || '').includes(search.toLowerCase())
    if (!matchesSearch) return false
    if (filter === 'all') return t.status !== 'done'
    if (filter === 'done') return t.status === 'done'
    if (filter === 'today') {
      if (!t.dueDate || t.status === 'done') return false
      const due = new Date(t.dueDate)
      due.setHours(0, 0, 0, 0)
      return due.getTime() === today.getTime()
    }
    if (filter === 'overdue') {
      if (!t.dueDate || t.status === 'done') return false
      return new Date(t.dueDate) < today
    }
    return true
  })

  const toggleTask = async (task: Task) => {
    if (togglingIds.has(task.id)) return
    setTogglingIds(prev => new Set(prev).add(task.id))
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)))
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)))
      setToast({ msg: 'Failed to update task', type: 'error' })
    } finally {
      setTogglingIds(prev => { const next = new Set(prev); next.delete(task.id); return next })
    }
  }

  const deleteTask = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation()
    // Two-step confirmation: first click arms, second confirms within 3s
    if (confirmDeleteId !== task.id) {
      setConfirmDeleteId(task.id)
      setTimeout(() => setConfirmDeleteId(curr => curr === task.id ? null : curr), 3000)
      return
    }
    setConfirmDeleteId(null)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setTasks(prev => prev.filter(t => t.id !== task.id))
      setToast({ msg: 'Task deleted' })
    } catch {
      setToast({ msg: 'Failed to delete task', type: 'error' })
    }
  }

  const openEditModal = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation()
    setEditTarget(task)
    setEditForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      dueTime: task.dueTime || '',
      projectId: task.projectId || '',
      assigneeId: task.assigneeId || '',
      category: task.category || '',
    })
    if (projects.length === 0) {
      fetch('/api/projects').then(r => r.json()).then(d => {
        const ps = d.projects || d
        setProjects(ps.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
      }).catch(() => {})
    }
    if (team.length === 0) {
      fetch('/api/team').then(r => r.json()).then(d => {
        setTeam((d.team || []).map((m: { id: string; name: string; avatarColor: string }) => ({ id: m.id, name: m.name, avatarColor: m.avatarColor })))
      }).catch(() => {})
    }
  }

  const saveEdit = async () => {
    if (!editTarget || !editForm.title.trim()) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/tasks/${editTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title.trim(),
          description: editForm.description.trim() || null,
          priority: editForm.priority,
          dueDate: editForm.dueDate || null,
          dueTime: editForm.dueTime || null,
          projectId: editForm.projectId || null,
          assigneeId: editForm.assigneeId || null,
          category: editForm.category || null,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const updated = await res.json()
      setTasks(prev => prev.map(t => t.id === editTarget.id ? updated : t))
      setEditTarget(null)
      setToast({ msg: 'Task updated' })
    } catch {
      setToast({ msg: 'Failed to update task', type: 'error' })
    } finally {
      setSavingEdit(false)
    }
  }

  const overdueCount = tasks.filter((t) => {
    if (!t.dueDate || t.status === 'done') return false
    return new Date(t.dueDate) < today
  }).length

  const selectStyle: React.CSSProperties = {
    width: '100%',
    background: '#1a2f4e',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: '11px 14px',
    color: '#eef3fa',
    fontFamily: 'var(--font-system)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    appearance: 'none',
  }

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <MobileHeader
        title="Tasks"
        subtitle={selectMode ? `${selectedIds.size} selected` : `${tasks.filter((t) => t.status !== 'done').length} remaining`}
        notifCount={overdueCount}
        rightSlot={
          <button
            onClick={() => { if (selectMode) exitSelectMode(); else setSelectMode(true) }}
            style={{ background: selectMode ? '#f59e0b' : 'rgba(255,255,255,0.07)', color: selectMode ? '#fff' : '#8ea8c5', border: 'none', borderRadius: 10, padding: '7px 12px', fontFamily: 'var(--font-system)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            {selectMode ? 'Done' : 'Select'}
          </button>
        }
      />

      {/* Search bar */}
      <div style={{ padding: '10px 16px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#152641', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '9px 14px' }}>
          <IcSearch size={14} color="#52749a" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks, projects, people…" style={{ background: 'none', border: 'none', outline: 'none', color: '#eef3fa', fontFamily: 'var(--font-system)', fontSize: 13, flex: 1 }} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><IcX size={14} color="#52749a" /></button>}
        </div>
      </div>

      {/* Filter chips */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '10px 16px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {filters.map((f) => {
          const count =
            f.id === 'all' ? tasks.filter((t) => t.status !== 'done').length :
            f.id === 'done' ? tasks.filter((t) => t.status === 'done').length :
            f.id === 'today' ? tasks.filter((t) => {
              if (!t.dueDate || t.status === 'done') return false
              const due = new Date(t.dueDate)
              due.setHours(0, 0, 0, 0)
              return due.getTime() === today.getTime()
            }).length :
            overdueCount

          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 14px',
                borderRadius: 99,
                border: 'none',
                fontSize: 12,
                fontWeight: f.id === filter ? 700 : 500,
                color: f.id === filter ? '#0c1a2e' : '#52749a',
                background: f.id === filter ? '#f59e0b' : 'rgba(255,255,255,0.06)',
                cursor: 'pointer',
                fontFamily: 'var(--font-system)',
                whiteSpace: 'nowrap',
              }}
            >
              {f.label}
              {count > 0 && (
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: f.id === filter ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 700,
                    color: f.id === filter ? '#0c1a2e' : '#8ea8c5',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Task list */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: 72, borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }} />
          ))
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#ef4444', fontFamily: 'var(--font-system)', fontSize: 14 }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#52749a', fontFamily: 'var(--font-system)', fontSize: 14 }}>
            No {filter === 'all' ? '' : filter} tasks
          </div>
        ) : (
          filtered.map((task) => {
            const isDone = task.status === 'done'
            const isOverdue = task.dueDate && new Date(task.dueDate) < today && !isDone
            const pColor = priorityColor[task.priority] || '#f59e0b'

            const isSelected = selectedIds.has(task.id)
            return (
              <div
                key={task.id}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 16,
                  background: isSelected ? 'rgba(245,158,11,0.12)' : (isDone ? 'rgba(255,255,255,0.02)' : (priorityBg[task.priority] || 'rgba(255,255,255,0.04)')),
                  border: `1px solid ${isSelected ? '#f59e0b' : (isDone ? 'rgba(255,255,255,0.05)' : `${pColor}33`)}`,
                  cursor: 'pointer',
                  opacity: isDone && !isSelected ? 0.6 : 1,
                }}
                onClick={() => selectMode ? toggleSelected(task.id) : toggleTask(task)}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 8,
                    background: isDone ? '#10b981' : `${pColor}22`,
                    border: `1.5px solid ${isDone ? '#10b981' : pColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {isDone && <IcCheck size={13} color="#fff" />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: isDone ? '#52749a' : '#eef3fa',
                      fontFamily: 'var(--font-system)',
                      textDecoration: isDone ? 'line-through' : 'none',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {task.title}
                  </p>

                  {task.description && (
                    <p style={{ fontSize: 11, color: '#52749a', marginTop: 2, fontFamily: 'var(--font-system)', lineHeight: 1.4 }}>
                      {task.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    {task.project && (
                      <span style={{ fontSize: 11, color: '#52749a', fontFamily: 'var(--font-system)' }}>
                        {task.project.name}
                      </span>
                    )}
                    {task.dueDate && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <IcClock size={11} color={isOverdue ? '#ef4444' : '#52749a'} />
                        <span style={{ fontSize: 11, color: isOverdue ? '#ef4444' : '#52749a', fontFamily: 'var(--font-system)' }}>
                          {new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          {task.dueTime && ` · ${task.dueTime}`}
                        </span>
                      </div>
                    )}
                    {(task._count?.comments ?? 0) > 0 && (
                      <span aria-label={`${task._count?.comments} comments`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#8ea8c5', fontFamily: 'var(--font-system)' }}>
                        💬 {task._count?.comments}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <Pill label={task.priority} />
                  {task.category && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: '#8ea8c5', fontFamily: 'var(--font-system)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{task.category}</span>
                  )}
                  {task.assignee && (
                    <Avatar name={task.assignee.name} color={task.assignee.avatarColor} size={22} />
                  )}
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={(e) => openEditModal(e, task)}
                      aria-label="Edit task"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0.4, display: 'flex' }}
                    >
                      <IcEdit size={13} color="#8ea8c5" />
                    </button>
                    <button
                      onClick={(e) => deleteTask(e, task)}
                      aria-label={confirmDeleteId === task.id ? 'Confirm delete task' : 'Delete task'}
                      style={{ background: confirmDeleteId === task.id ? 'rgba(239,68,68,0.2)' : 'none', borderRadius: 4, border: 'none', cursor: 'pointer', padding: confirmDeleteId === task.id ? '2px 6px' : 2, opacity: confirmDeleteId === task.id ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <IcTrash size={13} color="#ef4444" />
                      {confirmDeleteId === task.id && <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', fontFamily: 'var(--font-system)' }}>Sure?</span>}
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {selectMode && selectedIds.size > 0 && (
        <div style={{ position: 'fixed', bottom: 76, left: '50%', transform: 'translateX(-50%)', maxWidth: 480, width: 'calc(100% - 24px)', background: 'rgba(12,26,46,0.98)', backdropFilter: 'blur(12px)', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(245,158,11,0.3)', zIndex: 90, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          <span style={{ flex: 1, fontFamily: 'var(--font-system)', fontSize: 13, color: '#eef3fa', fontWeight: 600 }}>{selectedIds.size} selected</span>
          <button onClick={() => bulk('complete')} disabled={bulkSaving} style={{ padding: '7px 12px', borderRadius: 8, background: '#10b981', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: bulkSaving ? 0.5 : 1 }}>Done</button>
          <button onClick={() => bulk('reopen')} disabled={bulkSaving} style={{ padding: '7px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: 'none', color: '#eef3fa', fontFamily: 'var(--font-system)', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: bulkSaving ? 0.5 : 1 }}>Reopen</button>
          <button onClick={() => bulk('delete')} disabled={bulkSaving} style={{ padding: '7px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontFamily: 'var(--font-system)', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: bulkSaving ? 0.5 : 1 }}>Delete</button>
        </div>
      )}

      <TabBar accent="#f59e0b" />

      {/* New task modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ fontFamily: 'var(--font-system)', fontSize: 18, fontWeight: 700, color: '#eef3fa' }}>New task</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>

            {/* Title */}
            <div>
              <label style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Task title *</label>
              <input
                autoFocus
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Install kitchen units"
                style={{ width: '100%', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#eef3fa', fontFamily: 'var(--font-system)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Notes */}
            <div>
              <label style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Notes</label>
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional details" style={{ width: '100%', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#eef3fa', fontFamily: 'var(--font-system)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Priority */}
            <div>
              <label style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>Priority</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {PRIORITIES.map(p => (
                  <button key={p} onClick={() => setForm(prev => ({ ...prev, priority: p }))} style={{ flex: 1, padding: '8px 4px', borderRadius: 10, background: form.priority === p ? `${priorityColor[p]}22` : 'rgba(255,255,255,0.05)', border: `1px solid ${form.priority === p ? priorityColor[p] : 'rgba(255,255,255,0.1)'}`, color: form.priority === p ? priorityColor[p] : '#8ea8c5', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-system)', textTransform: 'capitalize' }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Due date & time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Due date</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
                  style={{ width: '100%', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#eef3fa', fontFamily: 'var(--font-system)', fontSize: 14, outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }}
                />
              </div>
              <div>
                <label style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Time</label>
                <input
                  type="time"
                  value={form.dueTime}
                  onChange={e => setForm(p => ({ ...p, dueTime: e.target.value }))}
                  style={{ width: '100%', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#eef3fa', fontFamily: 'var(--font-system)', fontSize: 14, outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }}
                />
              </div>
            </div>

            {/* Project */}
            <div>
              <label style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Project</label>
              <select value={form.projectId} onChange={e => setForm(p => ({ ...p, projectId: e.target.value }))} style={selectStyle}>
                <option value="">No project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* Assignee */}
            <div>
              <label style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Assignee</label>
              <select value={form.assigneeId} onChange={e => setForm(p => ({ ...p, assigneeId: e.target.value }))} style={selectStyle}>
                <option value="">Unassigned</option>
                {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={selectStyle}>
                {CATEGORIES.map(c => <option key={c || 'none'} value={c}>{c || 'None'}</option>)}
              </select>
            </div>

            <button onClick={createTask} disabled={saving || !form.title.trim()} style={{ marginTop: 4, padding: '14px 0', borderRadius: 14, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.title.trim() ? 0.5 : 1 }}>
              {saving ? 'Creating…' : 'Create task'}
            </button>
          </div>
        </div>
      )}

      {/* Edit task modal */}
      {editTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setEditTarget(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ fontFamily: 'var(--font-system)', fontSize: 18, fontWeight: 700, color: '#eef3fa' }}>Edit task</h3>
              <button onClick={() => setEditTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>

            <div>
              <label style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Task title *</label>
              <input autoFocus value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} style={{ width: '100%', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#eef3fa', fontFamily: 'var(--font-system)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Notes</label>
              <input value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional details" style={{ width: '100%', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#eef3fa', fontFamily: 'var(--font-system)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>Priority</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {PRIORITIES.map(p => (
                  <button key={p} onClick={() => setEditForm(prev => ({ ...prev, priority: p }))} style={{ flex: 1, padding: '8px 4px', borderRadius: 10, background: editForm.priority === p ? `${priorityColor[p]}22` : 'rgba(255,255,255,0.05)', border: `1px solid ${editForm.priority === p ? priorityColor[p] : 'rgba(255,255,255,0.1)'}`, color: editForm.priority === p ? priorityColor[p] : '#8ea8c5', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-system)', textTransform: 'capitalize' }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Due date</label>
                <input type="date" value={editForm.dueDate} onChange={e => setEditForm(p => ({ ...p, dueDate: e.target.value }))} style={{ width: '100%', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#eef3fa', fontFamily: 'var(--font-system)', fontSize: 14, outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }} />
              </div>
              <div>
                <label style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Time</label>
                <input type="time" value={editForm.dueTime} onChange={e => setEditForm(p => ({ ...p, dueTime: e.target.value }))} style={{ width: '100%', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#eef3fa', fontFamily: 'var(--font-system)', fontSize: 14, outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }} />
              </div>
            </div>

            <div>
              <label style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Project</label>
              <select value={editForm.projectId} onChange={e => setEditForm(p => ({ ...p, projectId: e.target.value }))} style={selectStyle}>
                <option value="">No project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Assignee</label>
              <select value={editForm.assigneeId} onChange={e => setEditForm(p => ({ ...p, assigneeId: e.target.value }))} style={selectStyle}>
                <option value="">Unassigned</option>
                {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Category</label>
              <select value={editForm.category} onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))} style={selectStyle}>
                {CATEGORIES.map(c => <option key={c || 'none'} value={c}>{c || 'None'}</option>)}
              </select>
            </div>

            <button onClick={saveEdit} disabled={savingEdit || !editForm.title.trim()} style={{ marginTop: 4, padding: '14px 0', borderRadius: 14, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: savingEdit || !editForm.title.trim() ? 0.5 : 1 }}>
              {savingEdit ? 'Saving…' : 'Save changes'}
            </button>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 14, marginTop: 8 }}>
              <CommentsThread taskId={editTarget.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
