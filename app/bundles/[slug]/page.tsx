'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Button from '@/components/ui/Button'
import Toast from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { BUNDLES, type Bundle, type BundleAction } from '@/lib/bundles'
import { useDashboardData } from '@/lib/useDashboardData'
import type { Project } from '@/lib/types'
import {
  IcChevL,
  IcSpark,
  IcSend,
  IcDoc,
  IcWrench,
  IcLayers,
  IcAlert,
  IcReceipt,
  IcHardhat,
  IcCheck,
  IcPin,
  IcCamera,
  IcClock,
  IcTeam,
  IcPound,
  IcBell,
} from '@/components/ui/Icons'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  doc: IcDoc,
  wrench: IcWrench,
  check: IcCheck,
  hardhat: IcHardhat,
  pin: IcPin,
  camera: IcCamera,
  alert: IcAlert,
  layers: IcLayers,
  team: IcTeam,
  clock: IcClock,
  receipt: IcReceipt,
  pound: IcPound,
  bell: IcBell,
}

interface ChatMessage { role: 'user' | 'assistant'; content: string }

const SF = 'var(--font-system)'

export default function BundlePage() {
  const { slug } = useParams<{ slug: string }>()
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const [actionOpen, setActionOpen] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])

  const { refetch } = useDashboardData()

  useEffect(() => {
    const b = BUNDLES.find(x => x.slug === slug)
    if (b) setBundle(b)
  }, [slug])

  useEffect(() => {
    fetch('/api/projects')
      .then(r => (r.ok ? r.json() : null))
      .then(d => setProjects((d?.projects || []).map((p: Project) => ({ id: p.id, name: p.name }))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || chatLoading) return
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setChatLoading(true)
    try {
      const res = await fetch(`/api/bundles/${bundle!.slug}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: messages }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Ask failed')
      setMessages([...next, { role: 'assistant', content: data.content || 'No response' }])
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Ask failed', type: 'error' })
      setMessages(messages)
    } finally {
      setChatLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const openAction = (key: string) => {
    setFields({ projectId: projects[0]?.id || '' })
    setActionOpen(key)
  }

  const closeAction = () => {
    setActionOpen(null)
    setFields({})
    setActionLoading(false)
  }

  const update = (key: string, value: string) => setFields(f => ({ ...f, [key]: value }))

  const activeAction = bundle?.actions.find(a => a.key === actionOpen)

  const submitAction = async () => {
    if (!activeAction) return
    const payload = buildPayload(activeAction.key, fields)
    if (payload instanceof Error) {
      setToast({ msg: payload.message, type: 'error' })
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch(activeAction.api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to create')
      setToast({ msg: `${activeAction.label} created`, type: 'success' })
      closeAction()
      refetch()
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed to create', type: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  if (!bundle) {
    return (
      <div style={{ background: '#06101e', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontFamily: SF }}>
        Unknown role pack
      </div>
    )
  }

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      <div style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/bundles" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: SF, fontSize: 13, color: '#52749a' }}>Role packs</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${bundle.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IcLayers size={22} color={bundle.color} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>{bundle.title}</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>{bundle.subtitle}</p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {bundle.pages.map(p => {
            const Icon = ICON_MAP[p.icon] || IcDoc
            return (
              <Link
                key={p.href}
                href={p.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 10px',
                  borderRadius: 10,
                  background: '#152641',
                  border: '0.5px solid rgba(255,255,255,0.07)',
                  textDecoration: 'none',
                }}
              >
                <Icon size={18} color={p.color} />
                <span style={{ fontFamily: SF, fontSize: 13, fontWeight: 600, color: '#eef3fa' }}>{p.label}</span>
              </Link>
            )
          })}
        </div>

        {bundle.actions.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 }}>
              Quick actions
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {bundle.actions.map(a => {
                const Icon = ICON_MAP[a.icon] || IcDoc
                return (
                  <button
                    key={a.key}
                    onClick={() => openAction(a.key)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: '12px 10px',
                      borderRadius: 10,
                      background: '#152641',
                      border: '0.5px solid rgba(255,255,255,0.07)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <Icon size={18} color={a.color} />
                    <span style={{ fontFamily: SF, fontSize: 13, fontWeight: 600, color: '#eef3fa' }}>{a.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ background: '#152641', borderRadius: 14, border: '0.5px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IcSpark size={16} color={bundle.color} />
            <span style={{ fontFamily: SF, fontSize: 14, fontWeight: 700, color: '#eef3fa' }}>Ask the {bundle.title.split(' ')[0]} agent</span>
          </div>

          <div style={{ padding: 12, maxHeight: '45vh', overflowY: 'auto' }}>
            {messages.length === 0 ? (
              <div style={{ color: '#52749a', fontFamily: SF, fontSize: 13, padding: '12px 4px' }}>
                Ask anything about {bundle.subtitle.toLowerCase()}. The agent knows the pages in this pack and current workspace context.
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div
                    style={{
                      maxWidth: '90%',
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: m.role === 'user' ? bundle.color : '#0a1426',
                      color: m.role === 'user' ? '#fff' : '#c1d2e8',
                      fontFamily: SF,
                      fontSize: 13,
                      lineHeight: 1.45,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{ padding: 10, borderTop: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', gap: 8 }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about this role pack…"
              rows={1}
              style={{
                flex: 1,
                background: '#0a1426',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: '10px 12px',
                color: '#eef3fa',
                fontFamily: SF,
                fontSize: 14,
                outline: 'none',
                resize: 'none',
                minHeight: 40,
              }}
            />
            <Button variant="primary" loading={chatLoading} onClick={send} style={{ height: 40, padding: '0 14px' }}>
              <IcSend size={16} color="#fff" />
            </Button>
          </div>
        </div>
      </div>

      {activeAction && (
        <Modal
          open={!!activeAction}
          title={activeAction.label}
          onClose={closeAction}
          confirmLabel="Create"
          loading={actionLoading}
          onConfirm={submitAction}
          size="md"
        >
          <ActionFormFields
            action={activeAction}
            fields={fields}
            projects={projects}
            onChange={update}
          />
        </Modal>
      )}

      <TabBar />
    </div>
  )
}

interface ActionFormFieldsProps {
  action: BundleAction
  fields: Record<string, string>
  projects: { id: string; name: string }[]
  onChange: (key: string, value: string) => void
}

function ActionFormFields({ action, fields, projects, onChange }: ActionFormFieldsProps) {
  const projectOptions = [{ value: '', label: '— Select project —' }, ...projects.map(p => ({ value: p.id, label: p.name }))]

  switch (action.key) {
    case 'raiseSnag':
      return (
        <>
          <FormField as="select" id="projectId" label="Project" options={projectOptions} value={fields.projectId || ''} onChange={e => onChange('projectId', e.target.value)} />
          <FormField id="title" label="Title" placeholder="e.g. Cracked render on east elevation" value={fields.title || ''} onChange={e => onChange('title', e.target.value)} />
          <FormField as="textarea" id="description" label="Description" placeholder="What is wrong and where…" value={fields.description || ''} onChange={e => onChange('description', e.target.value)} />
          <FormField id="location" label="Location" placeholder="e.g. Block B, 2nd floor" value={fields.location || ''} onChange={e => onChange('location', e.target.value)} />
          <PrioritySelect value={fields.priority || 'medium'} onChange={v => onChange('priority', v)} />
          <FormField id="dueDate" label="Due date" type="date" value={fields.dueDate || ''} onChange={e => onChange('dueDate', e.target.value)} />
        </>
      )
    case 'siteDiaryEntry':
      return (
        <>
          <FormField as="select" id="projectId" label="Project" options={projectOptions} value={fields.projectId || ''} onChange={e => onChange('projectId', e.target.value)} />
          <FormField as="textarea" id="note" label="Diary note" placeholder="What happened on site today…" value={fields.note || ''} onChange={e => onChange('note', e.target.value)} />
        </>
      )
    case 'equipmentCheck':
      return (
        <>
          <FormField as="select" id="projectId" label="Project (optional)" options={projectOptions} value={fields.projectId || ''} onChange={e => onChange('projectId', e.target.value)} />
          <FormField id="title" label="Title" placeholder="e.g. MEWP pre-start check" value={fields.title || ''} onChange={e => onChange('title', e.target.value)} />
          <FormField as="select" id="type" label="Equipment type" options={equipmentTypeOptions} value={fields.type || 'scissor_lift'} onChange={e => onChange('type', e.target.value)} />
          <FormField as="select" id="status" label="Status" options={equipmentStatusOptions} value={fields.status || 'draft'} onChange={e => onChange('status', e.target.value)} />
          <FormField as="textarea" id="notes" label="Notes" placeholder="Observations, defects, serial number…" value={fields.notes || ''} onChange={e => onChange('notes', e.target.value)} />
        </>
      )
    case 'createRams':
      return (
        <>
          <FormField as="select" id="projectId" label="Project" options={projectOptions} value={fields.projectId || ''} onChange={e => onChange('projectId', e.target.value)} />
          <FormField id="title" label="Title" placeholder="e.g. Roof works method statement" value={fields.title || ''} onChange={e => onChange('title', e.target.value)} />
          <FormField as="select" id="type" label="Type" options={ramsTypeOptions} value={fields.type || 'rams'} onChange={e => onChange('type', e.target.value)} />
          <FormField as="select" id="status" label="Status" options={ramsStatusOptions} value={fields.status || 'draft'} onChange={e => onChange('status', e.target.value)} />
          <FormField as="textarea" id="hazards" label="Hazards" placeholder="Key hazards for this work…" value={fields.hazards || ''} onChange={e => onChange('hazards', e.target.value)} />
          <FormField as="textarea" id="controls" label="Controls" placeholder="Control measures…" value={fields.controls || ''} onChange={e => onChange('controls', e.target.value)} />
          <FormField id="reviewBy" label="Review by" type="date" value={fields.reviewBy || ''} onChange={e => onChange('reviewBy', e.target.value)} />
        </>
      )
    case 'raiseRfi':
      return (
        <>
          <FormField as="select" id="projectId" label="Project" options={projectOptions} value={fields.projectId || ''} onChange={e => onChange('projectId', e.target.value)} />
          <FormField id="subject" label="Subject" placeholder="e.g. Confirm kitchen tile spec" value={fields.subject || ''} onChange={e => onChange('subject', e.target.value)} />
          <FormField as="textarea" id="body" label="Body" placeholder="Full question / clarification needed…" value={fields.body || ''} onChange={e => onChange('body', e.target.value)} />
          <PrioritySelect value={fields.priority || 'medium'} onChange={v => onChange('priority', v)} />
          <FormField id="dueDate" label="Response due" type="date" value={fields.dueDate || ''} onChange={e => onChange('dueDate', e.target.value)} />
        </>
      )
    case 'logInspection':
      return (
        <>
          <FormField as="select" id="projectId" label="Project" options={projectOptions} value={fields.projectId || ''} onChange={e => onChange('projectId', e.target.value)} />
          <FormField id="title" label="Title" placeholder="e.g. Weekly safety walk" value={fields.title || ''} onChange={e => onChange('title', e.target.value)} />
          <FormField as="select" id="type" label="Type" options={inspectionTypeOptions} value={fields.type || 'general'} onChange={e => onChange('type', e.target.value)} />
          <FormField as="textarea" id="notes" label="Notes" placeholder="Scope, attendees, items to check…" value={fields.notes || ''} onChange={e => onChange('notes', e.target.value)} />
        </>
      )
    case 'createTask':
      return (
        <>
          <FormField as="select" id="projectId" label="Project (optional)" options={projectOptions} value={fields.projectId || ''} onChange={e => onChange('projectId', e.target.value)} />
          <FormField id="title" label="Title" placeholder="e.g. Order scaffold materials" value={fields.title || ''} onChange={e => onChange('title', e.target.value)} />
          <FormField as="textarea" id="description" label="Description" placeholder="What needs to be done…" value={fields.description || ''} onChange={e => onChange('description', e.target.value)} />
          <PrioritySelect value={fields.priority || 'medium'} onChange={v => onChange('priority', v)} />
          <FormField id="dueDate" label="Due date" type="date" value={fields.dueDate || ''} onChange={e => onChange('dueDate', e.target.value)} />
        </>
      )
    case 'sendAnnouncement':
      return (
        <>
          <FormField as="select" id="projectId" label="Project (optional)" options={[{ value: '', label: '— Workspace-wide —' }, ...projects.map(p => ({ value: p.id, label: p.name }))]} value={fields.projectId || ''} onChange={e => onChange('projectId', e.target.value)} />
          <FormField id="title" label="Title" placeholder="e.g. Site access changes next week" value={fields.title || ''} onChange={e => onChange('title', e.target.value)} />
          <FormField as="select" id="type" label="Type" options={announcementTypeOptions} value={fields.type || 'general'} onChange={e => onChange('type', e.target.value)} />
          <FormField as="textarea" id="body" label="Message" placeholder="Write the announcement…" value={fields.body || ''} onChange={e => onChange('body', e.target.value)} />
        </>
      )
    case 'logRisk':
      return (
        <>
          <FormField as="select" id="projectId" label="Project" options={projectOptions} value={fields.projectId || ''} onChange={e => onChange('projectId', e.target.value)} />
          <FormField id="title" label="Risk" placeholder="e.g. Supply chain delay on cladding" value={fields.title || ''} onChange={e => onChange('title', e.target.value)} />
          <FormField as="select" id="category" label="Category" options={riskCategoryOptions} value={fields.category || 'operational'} onChange={e => onChange('category', e.target.value)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ScoreSelect label="Likelihood" value={fields.likelihood || '3'} onChange={v => onChange('likelihood', v)} />
            <ScoreSelect label="Impact" value={fields.impact || '3'} onChange={v => onChange('impact', v)} />
          </div>
          <FormField as="textarea" id="mitigation" label="Mitigation" placeholder="How will this be managed…" value={fields.mitigation || ''} onChange={e => onChange('mitigation', e.target.value)} />
          <FormField id="reviewBy" label="Review by" type="date" value={fields.reviewBy || ''} onChange={e => onChange('reviewBy', e.target.value)} />
        </>
      )
    case 'createQuote':
      return (
        <>
          <FormField id="title" label="Quote title" placeholder="e.g. Groundworks package" value={fields.title || ''} onChange={e => onChange('title', e.target.value)} />
          <FormField id="customerName" label="Customer" placeholder="Client or main contractor name" value={fields.customerName || ''} onChange={e => onChange('customerName', e.target.value)} />
          <FormField as="textarea" id="description" label="Description" placeholder="Scope of works…" value={fields.description || ''} onChange={e => onChange('description', e.target.value)} />
          <FormField id="vatRate" label="VAT rate %" type="number" placeholder="20" value={fields.vatRate || '20'} onChange={e => onChange('vatRate', e.target.value)} />
          <FormField id="validUntil" label="Valid until" type="date" value={fields.validUntil || ''} onChange={e => onChange('validUntil', e.target.value)} />
        </>
      )
    case 'createVariation':
      return (
        <>
          <FormField as="select" id="projectId" label="Project" options={projectOptions} value={fields.projectId || ''} onChange={e => onChange('projectId', e.target.value)} />
          <FormField id="title" label="Title" placeholder="e.g. Additional drainage runs" value={fields.title || ''} onChange={e => onChange('title', e.target.value)} />
          <FormField as="textarea" id="description" label="Description" placeholder="Change details and reason…" value={fields.description || ''} onChange={e => onChange('description', e.target.value)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField id="costImpact" label="Cost impact (£)" type="number" placeholder="0" value={fields.costImpact || ''} onChange={e => onChange('costImpact', e.target.value)} />
            <FormField id="daysImpact" label="Days impact" type="number" placeholder="0" value={fields.daysImpact || ''} onChange={e => onChange('daysImpact', e.target.value)} />
          </div>
        </>
      )
    case 'logInvoice':
      return (
        <>
          <FormField as="select" id="projectId" label="Project (optional)" options={projectOptions} value={fields.projectId || ''} onChange={e => onChange('projectId', e.target.value)} />
          <FormField id="number" label="Invoice number" placeholder="e.g. INV-001" value={fields.number || ''} onChange={e => onChange('number', e.target.value)} />
          <FormField id="clientName" label="Client name" placeholder="Who is being invoiced" value={fields.clientName || ''} onChange={e => onChange('clientName', e.target.value)} />
          <FormField id="amount" label="Amount (£)" type="number" placeholder="0.00" value={fields.amount || ''} onChange={e => onChange('amount', e.target.value)} />
          <FormField id="dueDate" label="Due date" type="date" value={fields.dueDate || ''} onChange={e => onChange('dueDate', e.target.value)} />
          <FormField as="select" id="status" label="Status" options={invoiceStatusOptions} value={fields.status || 'draft'} onChange={e => onChange('status', e.target.value)} />
        </>
      )
    default:
      return <div style={{ color: '#52749a', fontFamily: SF, fontSize: 13 }}>Unknown action</div>
  }
}

function PrioritySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <SegmentedControl value={value} onChange={onChange} options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Med' }, { value: 'high', label: 'High' }, { value: 'critical', label: 'Crit' }]} ariaLabel="Priority" />
}

function ScoreSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{ fontFamily: SF, fontSize: 11, color: 'var(--t3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' }}>{label}</label>
      <SegmentedControl value={value} onChange={onChange} options={[{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }, { value: '5', label: '5' }]} ariaLabel={label} />
    </div>
  )
}

const equipmentTypeOptions = [
  { value: 'scissor_lift', label: 'Scissor lift' },
  { value: 'cherry_picker', label: 'Cherry picker' },
  { value: 'telehandler', label: 'Telehandler' },
  { value: 'harness', label: 'Harness' },
  { value: 'fall_arrest', label: 'Fall arrest' },
  { value: 'ladder', label: 'Ladder' },
  { value: 'other', label: 'Other' },
]

const equipmentStatusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_progress', label: 'In progress' },
]

const ramsTypeOptions = [
  { value: 'rams', label: 'RAMS' },
  { value: 'risk_assessment', label: 'Risk assessment' },
  { value: 'method_statement', label: 'Method statement' },
]

const ramsStatusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'archived', label: 'Archived' },
]

const inspectionTypeOptions = [
  { value: 'general', label: 'General' },
  { value: 'safety', label: 'Safety' },
  { value: 'quality', label: 'Quality' },
  { value: 'scaffold', label: 'Scaffold' },
  { value: 'electrical', label: 'Electrical' },
]

const announcementTypeOptions = [
  { value: 'general', label: 'General' },
  { value: 'safety', label: 'Safety' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'update', label: 'Update' },
]

const riskCategoryOptions = [
  { value: 'operational', label: 'Operational' },
  { value: 'financial', label: 'Financial' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'safety', label: 'Safety' },
  { value: 'quality', label: 'Quality' },
  { value: 'environmental', label: 'Environmental' },
]

const invoiceStatusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
]

function buildPayload(key: string, fields: Record<string, string>): Record<string, unknown> | Error {
  const required = (name: string) => {
    const v = fields[name]?.trim()
    if (!v) throw new Error(`${name} is required`)
    return v
  }
  try {
    switch (key) {
      case 'raiseSnag':
        return {
          projectId: required('projectId'),
          title: required('title'),
          description: fields.description?.trim() || undefined,
          location: fields.location?.trim() || undefined,
          priority: fields.priority || 'medium',
          dueDate: fields.dueDate || undefined,
        }
      case 'siteDiaryEntry':
        return {
          projectId: required('projectId'),
          note: required('note'),
        }
      case 'equipmentCheck':
        return {
          title: required('title'),
          type: fields.type || 'scissor_lift',
          status: fields.status || 'draft',
          projectId: fields.projectId || undefined,
          notes: fields.notes?.trim() || undefined,
        }
      case 'createRams':
        return {
          projectId: required('projectId'),
          title: required('title'),
          type: fields.type || 'rams',
          status: fields.status || 'draft',
          hazards: fields.hazards?.trim() || undefined,
          controls: fields.controls?.trim() || undefined,
          reviewBy: fields.reviewBy || undefined,
        }
      case 'raiseRfi':
        return {
          projectId: required('projectId'),
          subject: required('subject'),
          body: required('body'),
          priority: fields.priority || 'medium',
          dueDate: fields.dueDate || undefined,
        }
      case 'logInspection':
        return {
          projectId: required('projectId'),
          title: required('title'),
          type: fields.type || 'general',
          notes: fields.notes?.trim() || undefined,
        }
      case 'createTask':
        return {
          projectId: fields.projectId || undefined,
          title: required('title'),
          description: fields.description?.trim() || undefined,
          priority: fields.priority || 'medium',
          dueDate: fields.dueDate || undefined,
        }
      case 'sendAnnouncement':
        return {
          projectId: fields.projectId || undefined,
          title: required('title'),
          body: required('body'),
          type: fields.type || 'general',
        }
      case 'logRisk':
        return {
          projectId: required('projectId'),
          title: required('title'),
          category: fields.category || 'operational',
          likelihood: Number(fields.likelihood || 3),
          impact: Number(fields.impact || 3),
          mitigation: fields.mitigation?.trim() || undefined,
          reviewBy: fields.reviewBy || undefined,
        }
      case 'createQuote':
        return {
          title: required('title'),
          customerName: required('customerName'),
          description: fields.description?.trim() || undefined,
          vatRate: fields.vatRate?.trim() ? Number(fields.vatRate) : undefined,
          validUntil: fields.validUntil || undefined,
          status: 'draft',
        }
      case 'createVariation':
        return {
          projectId: required('projectId'),
          title: required('title'),
          description: fields.description?.trim() || undefined,
          costImpact: Number(fields.costImpact || 0),
          daysImpact: Number(fields.daysImpact || 0),
        }
      case 'logInvoice':
        return {
          number: required('number'),
          clientName: required('clientName'),
          amount: Number(required('amount')),
          dueDate: required('dueDate'),
          projectId: fields.projectId || undefined,
          status: fields.status || 'draft',
        }
      default:
        return new Error('Unknown action')
    }
  } catch (e) {
    return e instanceof Error ? e : new Error(String(e))
  }
}
