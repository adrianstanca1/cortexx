'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Avatar from '@/components/ui/Avatar'
import Toast from '@/components/ui/Toast'
import { IcChevL, IcCheck } from '@/components/ui/Icons'

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  category: string | null
  dueDate: string | null
  assignee?: { id: string; name: string; avatarColor: string } | null
}

const COLUMNS = [
  { id: 'todo', label: 'To do', color: '#52749a' },
  { id: 'in_progress', label: 'In progress', color: '#f59e0b' },
  { id: 'done', label: 'Done', color: '#10b981' },
]

const priorityColor: Record<string, string> = { critical: '#ef4444', high: '#f59e0b', medium: '#2563eb', low: '#52749a' }

export default function ProjectBoardPage() {
  const { id } = useParams<{ id: string }>()
  const [tasks, setTasks] = useState<Task[]>([])
  const [projectName, setProjectName] = useState('Project')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)

  const load = useCallback(() => {
    if (!id) return
    Promise.all([
      fetch(`/api/tasks?projectId=${id}&take=100`).then(r => r.json()),
      fetch(`/api/projects/${id}`).then(r => r.json()),
    ])
      .then(([t, p]) => {
        setTasks(t.tasks || [])
        setProjectName(p.project?.name || 'Project')
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  const move = async (taskId: string, status: string) => {
    const original = tasks.find(t => t.id === taskId)?.status
    if (original === status) return
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      setTasks(prev => prev.map(t => t.id === taskId && original ? { ...t, status: original } : t))
      setToast({ msg: 'Failed to move task', type: 'error' })
    }
  }

  const onDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  const onDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    if (id) move(id, status)
  }

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <div style={{ padding: '20px 20px 12px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href={`/projects/${id}`} style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>{projectName}</span>
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: 'var(--font-system)' }}>Board</h1>
        <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: 'var(--font-system)' }}>Drag tasks between columns or tap to advance</p>
      </div>

      <div style={{ padding: '12px 12px 16px', display: 'flex', gap: 8, overflowX: 'auto' }}>
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id)
          return (
            <div
              key={col.id}
              onDragOver={onDragOver}
              onDrop={e => onDrop(e, col.id)}
              style={{ minWidth: 240, flex: '0 0 240px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px 4px' }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: col.color }} />
                <span style={{ fontFamily: 'var(--font-system)', fontSize: 12, fontWeight: 700, color: '#eef3fa', textTransform: 'uppercase', letterSpacing: 0.4 }}>{col.label}</span>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#52749a' }}>· {colTasks.length}</span>
              </div>
              {loading ? null : colTasks.length === 0 ? (
                <p style={{ padding: 12, textAlign: 'center', color: '#52749a', fontFamily: 'var(--font-system)', fontSize: 11 }}>No tasks</p>
              ) : (
                colTasks.map(t => {
                  const next = col.id === 'todo' ? 'in_progress' : col.id === 'in_progress' ? 'done' : 'todo'
                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={e => onDragStart(e, t.id)}
                      onClick={() => move(t.id, next)}
                      style={{ background: '#152641', borderRadius: 10, padding: 10, border: `0.5px solid ${priorityColor[t.priority] || '#52749a'}33`, cursor: 'pointer', opacity: col.id === 'done' ? 0.7 : 1 }}
                    >
                      <p style={{ fontFamily: 'var(--font-system)', fontSize: 12, fontWeight: 600, color: '#eef3fa', textDecoration: col.id === 'done' ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</p>
                      {t.description && (
                        <p style={{ fontFamily: 'var(--font-system)', fontSize: 10, color: '#8ea8c5', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.description}</p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 3, background: priorityColor[t.priority] }} />
                        <span style={{ fontFamily: 'var(--font-system)', fontSize: 9, color: '#8ea8c5', textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: 600 }}>{t.priority}</span>
                        {t.assignee && (
                          <span style={{ marginLeft: 'auto' }}>
                            <Avatar name={t.assignee.name} color={t.assignee.avatarColor} size={18} />
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )
        })}
      </div>

      <TabBar />
    </div>
  )
}
