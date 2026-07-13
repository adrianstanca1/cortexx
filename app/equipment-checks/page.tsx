'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import SegmentedControl from '@/components/ui/SegmentedControl'
import Button from '@/components/ui/Button'
import {
  EQUIPMENT_CHECK_TEMPLATES,
  EQUIPMENT_TYPES,
  CheckTemplate,
} from '@/lib/equipment-check-templates'
import {
  IcCheck,
  IcChevL,
  IcPlus,
  IcTrash,
  IcAlert,
  IcWrench,
  IcEdit,
} from '@/components/ui/Icons'

interface Check {
  id: string
  title: string
  type: string
  status: 'draft' | 'in_progress' | 'passed' | 'failed'
  checklistItems: Array<{ id: string; label: string; result?: 'pass' | 'fail' | 'na'; note?: string }>
  overallResult?: 'pass' | 'fail' | null
  conductedBy?: string | null
  completedAt?: string | null
  lastCompletedAt?: string | null
  frequency?: 'none' | 'daily' | 'weekly' | 'monthly' | string
  nextDueAt?: string | null
  notes?: string | null
  project?: { id: string; name: string } | null
  equipment?: { id: string; name: string; code: string | null } | null
  createdAt: string
  updatedAt: string
}

interface Project { id: string; name: string }
interface Equipment { id: string; name: string; code: string | null }

const STATUS_LABEL: Record<Check['status'], string> = {
  draft: 'Draft',
  in_progress: 'In progress',
  passed: 'Passed',
  failed: 'Failed',
}
const STATUS_COLOR: Record<Check['status'], string> = {
  draft: '#52749a',
  in_progress: '#06b6d4',
  passed: '#10b981',
  failed: '#ef4444',
}
const FREQUENCY_OPTIONS = [
  { value: 'none', label: 'One-off' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]
const SF = 'var(--font-system)'

export default function EquipmentChecksPage() {
  const [checks, setChecks] = useState<Check[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | Check['status'] | 'overdue'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | string>('all')
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [createType, setCreateType] = useState('scissor_lift')
  const [createTitle, setCreateTitle] = useState('')
  const [createProjectId, setCreateProjectId] = useState('')
  const [createEquipmentId, setCreateEquipmentId] = useState('')
  const [createFrequency, setCreateFrequency] = useState('none')
  const [createConductedBy, setCreateConductedBy] = useState('')
  const [createNotes, setCreateNotes] = useState('')
  const [createSaving, setCreateSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all' && statusFilter !== 'overdue') params.set('status', statusFilter)
      if (typeFilter !== 'all') params.set('type', typeFilter)
      const checkUrl = statusFilter === 'overdue'
        ? '/api/equipment-checks/overdue'
        : `/api/equipment-checks?${params.toString()}`
      const [cRes, pRes, eRes] = await Promise.all([
        fetch(checkUrl),
        fetch('/api/projects?status=active'),
        fetch('/api/equipment'),
      ])
      if (!cRes.ok) throw new Error('Failed to load checks')
      const cData = await cRes.json()
      setChecks(cData.checks || [])
      if (pRes.ok) {
        const pData = await pRes.json()
        setProjects((pData.projects || []).map((p: Project) => ({ id: p.id, name: p.name })))
      }
      if (eRes.ok) {
        const eData = await eRes.json()
        setEquipment((eData.equipment || []).map((e: Equipment) => ({ id: e.id, name: e.name, code: e.code })))
      }
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter])

  useEffect(() => { load() }, [load])

  const openCreate = (type: string) => {
    const template = EQUIPMENT_CHECK_TEMPLATES[type]
    setEditingId(null)
    setCreateType(type)
    setCreateTitle(template ? template.title : 'Equipment check')
    setCreateProjectId(projects[0]?.id || '')
    setCreateEquipmentId('')
    setCreateFrequency('none')
    setCreateConductedBy('')
    setCreateNotes('')
    setShowCreate(true)
  }

  const openEdit = (c: Check) => {
    setEditingId(c.id)
    setCreateType(c.type)
    setCreateTitle(c.title)
    setCreateProjectId(c.project?.id || '')
    setCreateEquipmentId(c.equipment?.id || '')
    setCreateFrequency(c.frequency || 'none')
    setCreateConductedBy(c.conductedBy || '')
    setCreateNotes(c.notes || '')
    setShowCreate(true)
  }

  const resetCreate = () => {
    setEditingId(null)
    setCreateType('scissor_lift')
    setCreateTitle('')
    setCreateProjectId(projects[0]?.id || '')
    setCreateEquipmentId('')
    setCreateFrequency('none')
    setCreateConductedBy('')
    setCreateNotes('')
  }

  const save = async () => {
    const template = EQUIPMENT_CHECK_TEMPLATES[createType]
    if (!createTitle.trim()) return setToast({ msg: 'Title required', type: 'error' })
    setCreateSaving(true)
    try {
      const payload: Record<string, unknown> = {
        title: createTitle.trim(),
        type: createType,
        projectId: createProjectId || null,
        equipmentId: createEquipmentId || null,
        frequency: createFrequency,
        conductedBy: createConductedBy || null,
        notes: createNotes || null,
      }
      if (editingId) {
        const res = await fetch(`/api/equipment-checks/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed to update')
        setToast({ msg: 'Check updated', type: 'success' })
      } else {
        payload.checklistItems = template ? template.items : []
        payload.status = 'draft'
        const res = await fetch('/api/equipment-checks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed to save')
        setToast({ msg: 'Check created', type: 'success' })
      }
      setShowCreate(false)
      resetCreate()
      load()
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Save failed', type: 'error' })
    } finally {
      setCreateSaving(false)
    }
  }

  const updateItem = async (check: Check, itemId: string, result: 'pass' | 'fail' | 'na') => {
    const items = check.checklistItems.map(it => it.id === itemId ? { ...it, result } : it)
    try {
      const res = await fetch(`/api/equipment-checks/${check.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklistItems: items,
          status: check.status === 'draft' ? 'in_progress' : check.status,
        }),
      })
      if (!res.ok) throw new Error()
      load()
    } catch {
      setToast({ msg: 'Update failed', type: 'error' })
    }
  }

  const setStatus = async (check: Check, status: Check['status']) => {
    try {
      const res = await fetch(`/api/equipment-checks/${check.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      load()
      setToast({ msg: `Marked ${status.replace(/_/g, ' ')}`, type: 'success' })
    } catch {
      setToast({ msg: 'Update failed', type: 'error' })
    }
  }

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/equipment-checks/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setConfirmDelete(null)
      load()
      setToast({ msg: 'Check deleted', type: 'success' })
    } catch {
      setToast({ msg: 'Delete failed', type: 'error' })
    }
  }

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
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF, display: 'flex', alignItems: 'center', gap: 8 }}>
              <IcWrench size={20} color="#f59e0b" /> Equipment checks
            </h1>
            <p style={{ fontSize: 11, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {checks.length} checks · {checks.filter(c => c.status === 'failed').length} failed
              {(() => {
                const overdueCount = checks.filter(
                  c => c.nextDueAt && c.status !== 'passed' && new Date(c.nextDueAt) < new Date()
                ).length
                return overdueCount > 0 ? ` · ${overdueCount} overdue` : null
              })()}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {(['all', 'draft', 'in_progress', 'passed', 'failed', 'overdue'] as const).map(s => {
              const color = s === 'all' ? '#8b5cf6' : s === 'overdue' ? '#ef4444' : STATUS_COLOR[s as Check['status']]
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    flexShrink: 0,
                    padding: '5px 12px',
                    borderRadius: 999,
                    border: 'none',
                    background: statusFilter === s ? color : '#152641',
                    color: statusFilter === s ? '#fff' : '#c1d2e8',
                    fontFamily: SF,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {s.replace(/_/g, ' ')}
                </button>
              )
            })}
          </div>

          <SegmentedControl
            value={typeFilter}
            onChange={setTypeFilter}
            options={[{ value: 'all', label: 'All types' }, ...EQUIPMENT_TYPES]}
            size="sm"
            ariaLabel="Filter by equipment type"
          />
        </div>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {EQUIPMENT_TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => openCreate(t.value)}
            style={{
              background: '#152641',
              border: '0.5px solid rgba(255,255,255,0.07)',
              borderRadius: 12,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${t.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IcPlus size={18} color={t.color} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: '#eef3fa' }}>New {t.label} check</div>
              <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a' }}>{EQUIPMENT_CHECK_TEMPLATES[t.value]?.items.length || 0} standard items</div>
            </div>
          </button>
        ))}
      </div>

      {loading && <div style={{ padding: 24, color: '#8ea8c5', fontFamily: SF, fontSize: 13 }}>Loading…</div>}
      {error && <div style={{ padding: 24, color: '#fca5a5', fontFamily: SF, fontSize: 13 }}>{error}</div>}
      {!loading && checks.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>No equipment checks yet. Pick a type above to start.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px' }}>
        {checks.map(c => {
          const isOpen = expanded === c.id
          const total = c.checklistItems.length
          const done = c.checklistItems.filter(it => it.result).length
          const failed = c.checklistItems.filter(it => it.result === 'fail').length
          const overdue = c.nextDueAt && c.status !== 'passed' && new Date(c.nextDueAt) < new Date()
          const dueLabel = c.nextDueAt
            ? `Due ${new Date(c.nextDueAt).toLocaleDateString()}${c.frequency && c.frequency !== 'none' ? ` (${c.frequency})` : ''}`
            : c.frequency && c.frequency !== 'none'
              ? `Repeats ${c.frequency}`
              : null
          return (
            <div key={c.id} style={{ background: '#152641', border: `0.5px solid ${c.status === 'failed' || overdue ? '#ef444466' : 'rgba(255,255,255,0.07)'}`, borderRadius: 12, padding: 14 }}>
              <div onClick={() => setExpanded(isOpen ? null : c.id)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ background: 'rgba(255,255,255,0.08)', color: '#c1d2e8', padding: '2px 8px', borderRadius: 6, fontFamily: SF, fontSize: 10, fontWeight: 700, textTransform: 'capitalize' }}>{c.type.replace(/_/g, ' ')}</span>
                  <span style={{ background: STATUS_COLOR[c.status] + '33', color: STATUS_COLOR[c.status], padding: '2px 8px', borderRadius: 6, fontFamily: SF, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{STATUS_LABEL[c.status]}</span>
                  {failed > 0 && c.status !== 'passed' && <span style={{ color: '#ef4444', fontFamily: SF, fontSize: 10, fontWeight: 700 }}>{failed} FAIL</span>}
                  {overdue && <span style={{ background: '#ef444433', color: '#ef4444', padding: '2px 8px', borderRadius: 6, fontFamily: SF, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Overdue</span>}
                </div>
                <div style={{ fontFamily: SF, fontSize: 14, color: '#eef3fa', fontWeight: 600 }}>{c.title}</div>
                <div style={{ fontFamily: SF, fontSize: 11, color: overdue ? '#fca5a5' : '#52749a', marginTop: 2 }}>
                  {c.project?.name || '—'}
                  {c.equipment && <span> · {c.equipment.name} {c.equipment.code && `(${c.equipment.code})`}</span>}
                  {c.conductedBy && <span> · {c.conductedBy}</span>}
                  <span> · {done}/{total} checked</span>
                  {dueLabel && <span> · {dueLabel}</span>}
                </div>
              </div>

              {isOpen && (
                <>
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {c.checklistItems.map(item => (
                      <div key={item.id} style={{ background: '#0a1426', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, fontFamily: SF, fontSize: 13, color: '#c1d2e8' }}>{item.label}</div>
                        {(['pass', 'fail', 'na'] as const).map(r => (
                          <button
                            key={r}
                            onClick={() => updateItem(c, item.id, r)}
                            style={{
                              background: item.result === r ? (r === 'pass' ? '#10b981' : r === 'fail' ? '#ef4444' : '#52749a') : 'transparent',
                              border: '0.5px solid rgba(255,255,255,0.1)',
                              borderRadius: 6,
                              padding: '4px 8px',
                              color: item.result === r ? '#fff' : '#8ea8c5',
                              fontFamily: SF,
                              fontSize: 10,
                              fontWeight: 700,
                              cursor: 'pointer',
                              textTransform: 'uppercase',
                            }}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {c.status !== 'passed' && (
                      <Button size="sm" variant="primary" onClick={() => setStatus(c, 'passed')} style={{ background: '#10b981' }}>
                        <IcCheck size={11} color="#fff" /> Pass
                      </Button>
                    )}
                    {c.status !== 'failed' && (
                      <Button size="sm" variant="danger" onClick={() => setStatus(c, 'failed')}>
                        <IcAlert size={11} color="#fff" /> Fail
                      </Button>
                    )}
                    {(c.status === 'passed' || c.status === 'failed') && (
                      <Button size="sm" variant="secondary" onClick={() => setStatus(c, 'in_progress')}>Reopen</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)} style={{ color: '#8ea8c5' }}>
                      <IcEdit size={11} color="#8ea8c5" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(c.id)} style={{ color: '#fca5a5' }}>
                      <IcTrash size={11} color="#fca5a5" /> Delete
                    </Button>
                  </div>
                </>
              )}

              {confirmDelete === c.id && (
                <div style={{ marginTop: 10, padding: 10, background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.4)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontFamily: SF, fontSize: 12, color: '#fca5a5' }}>Delete this check?</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                    <Button size="sm" variant="danger" onClick={() => remove(c.id)}>Delete</Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <TabBar />

      <Modal
        open={showCreate}
        title={editingId ? 'Edit equipment check' : `New ${EQUIPMENT_TYPES.find(t => t.value === createType)?.label || 'equipment'} check`}
        onClose={() => { setShowCreate(false); resetCreate() }}
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 18 }}>
            <Button variant="ghost" onClick={() => { setShowCreate(false); resetCreate() }} disabled={createSaving}>Cancel</Button>
            <Button variant="primary" loading={createSaving} onClick={save}>{editingId ? 'Save changes' : 'Create check'}</Button>
          </div>
        }
      >
        <FormField
          id="ec-title"
          label="Title"
          value={createTitle}
          onChange={e => setCreateTitle(e.target.value)}
          placeholder="e.g. Daily scissor lift check - Block A"
        />

        <FormField
          id="ec-type"
          as="select"
          label="Equipment type"
          value={createType}
          onChange={e => {
            const type = e.target.value
            setCreateType(type)
            const template = EQUIPMENT_CHECK_TEMPLATES[type]
            if (template && !createTitle.trim()) setCreateTitle(template.title)
          }}
          options={EQUIPMENT_TYPES}
        />

        <FormField
          id="ec-project"
          as="select"
          label="Project (optional)"
          value={createProjectId}
          onChange={e => setCreateProjectId(e.target.value)}
          options={[{ value: '', label: '— No project —' }, ...projects.map(p => ({ value: p.id, label: p.name }))]}
        />

        <FormField
          id="ec-equipment"
          as="select"
          label="Equipment asset (optional)"
          value={createEquipmentId}
          onChange={e => setCreateEquipmentId(e.target.value)}
          options={[{ value: '', label: '— Not listed —' }, ...equipment.map(e => ({ value: e.id, label: `${e.name}${e.code ? ` (${e.code})` : ''}` }))]}
        />

        <FormField
          id="ec-frequency"
          as="select"
          label="Frequency"
          value={createFrequency}
          onChange={e => setCreateFrequency(e.target.value)}
          options={FREQUENCY_OPTIONS}
        />

        <FormField
          id="ec-conducted"
          label="Conducted by"
          value={createConductedBy}
          onChange={e => setCreateConductedBy(e.target.value)}
          placeholder="Name of competent person"
        />

        <FormField
          id="ec-notes"
          as="textarea"
          label="Notes"
          value={createNotes}
          onChange={e => setCreateNotes(e.target.value)}
          placeholder="Any observations or corrective actions…"
          rows={3}
        />
      </Modal>
    </div>
  )
}
