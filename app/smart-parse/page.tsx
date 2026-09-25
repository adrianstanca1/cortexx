'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcChevL, IcCheck, IcSpark } from '@/components/ui/Icons'

type SmartRecord = {
  type: 'task' | 'customer' | 'quote' | 'project' | 'expense' | 'rfi' | 'snag'
  title: string
  fields: Record<string, unknown>
  confidence: number
  reason: string
  saved?: boolean
  saveError?: string
}

type ParseResult = { summary: string; records: SmartRecord[] }
type Project = { id: string; name: string }

const SF = 'var(--font-system)'

function str(fields: Record<string, unknown>, key: string): string {
  const value = fields[key]
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
}

function num(fields: Record<string, unknown>, key: string): number {
  const value = Number(fields[key])
  return Number.isFinite(value) ? value : 0
}

function priority(value: string): 'low' | 'medium' | 'high' | 'critical' {
  const v = value.toLowerCase()
  if (v === 'low' || v === 'high' || v === 'critical') return v
  return 'medium'
}

export default function SmartParsePage() {
  const [text, setText] = useState('')
  const [result, setResult] = useState<ParseResult | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [busy, setBusy] = useState(false)
  const [savingAll, setSavingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.ok ? r.json() : null)
      .then(d => setProjects((d?.projects || d || []).map((p: Project) => ({ id: p.id, name: p.name }))))
      .catch(() => {})
  }, [])

  const projectMap = useMemo(() => {
    return projects.map(p => ({ ...p, key: p.name.toLowerCase() }))
  }, [projects])

  const findProject = (hint: string) => {
    const key = hint.toLowerCase().trim()
    if (!key) return null
    return projectMap.find(p => p.key.includes(key) || key.includes(p.key)) || null
  }

  const parse = async () => {
    if (text.trim().length < 10 || busy) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/smart-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Smart Parse failed')
      setResult({ summary: json.summary || '', records: json.records || [] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Smart Parse failed')
    } finally {
      setBusy(false)
    }
  }

  const saveRecord = async (index: number) => {
    if (!result) return
    const rec = result.records[index]
    if (!rec || rec.saved) return
    const f = rec.fields || {}
    const project = findProject(str(f, 'projectHint'))
    let url = ''
    let body: Record<string, unknown> = {}

    if (rec.type === 'task') {
      url = '/api/tasks'
      body = {
        title: rec.title,
        description: str(f, 'description') || null,
        dueDate: str(f, 'dueDate') || null,
        priority: priority(str(f, 'priority')),
        projectId: project?.id || null,
        status: 'todo',
      }
    } else if (rec.type === 'customer') {
      url = '/api/customers'
      body = {
        name: str(f, 'name') || rec.title,
        contactEmail: str(f, 'email') || null,
        contactPhone: str(f, 'phone') || null,
        address: str(f, 'address') || null,
        postcode: str(f, 'postcode') || null,
      }
    } else if (rec.type === 'project') {
      const postcode = str(f, 'postcode')
      if (!postcode) throw new Error('Project needs a postcode before it can be created')
      url = '/api/projects'
      body = {
        name: str(f, 'name') || rec.title,
        clientName: str(f, 'clientName'),
        address: str(f, 'address'),
        postcode,
        budget: Math.max(0, num(f, 'budget')),
        startDate: str(f, 'startDate') || null,
        status: 'active',
      }
    } else if (rec.type === 'quote') {
      const customerName = str(f, 'customerName')
      if (!customerName) throw new Error('Quote needs a customer name before it can be drafted')
      const budget = Math.max(0, num(f, 'budget'))
      url = '/api/quotes'
      body = {
        title: rec.title,
        customerName,
        description: str(f, 'description') || null,
        lineItems: budget > 0 ? [{
          description: str(f, 'description') || rec.title,
          quantity: 1,
          unit: 'item',
          unitPrice: budget,
        }] : [],
        status: 'draft',
      }
    } else if (rec.type === 'rfi') {
      if (!project) throw new Error('RFI needs a matching project name in the note')
      url = '/api/rfis'
      body = {
        subject: str(f, 'subject') || rec.title,
        body: str(f, 'body') || rec.title,
        projectId: project.id,
        assignee: str(f, 'assignee') || null,
        dueDate: str(f, 'dueDate') || null,
        priority: priority(str(f, 'priority')),
      }
    } else if (rec.type === 'snag') {
      if (!project) throw new Error('Snag needs a matching project name in the note')
      url = '/api/snags'
      body = {
        title: rec.title,
        description: str(f, 'description') || rec.title,
        location: str(f, 'location') || null,
        projectId: project.id,
        priority: priority(str(f, 'priority')),
        dueDate: str(f, 'dueDate') || null,
      }
    } else {
      url = '/api/documents'
      const vendor = str(f, 'vendor')
      const amount = num(f, 'amount')
      const category = str(f, 'category')
      body = {
        name: rec.title,
        type: 'receipt',
        projectId: project?.id || null,
        tags: [
          vendor ? 'vendor:' + vendor : '',
          amount ? 'amount:' + amount.toFixed(2) : '',
          category ? 'category:' + category : '',
          'smart-parse',
        ].filter(Boolean),
      }
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Save failed')
      setResult(prev => prev ? {
        ...prev,
        records: prev.records.map((r, i) => i === index ? { ...r, saved: true, saveError: undefined } : r),
      } : prev)
      setToast({ msg: rec.type + ' saved' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed'
      setResult(prev => prev ? {
        ...prev,
        records: prev.records.map((r, i) => i === index ? { ...r, saveError: msg } : r),
      } : prev)
      throw e
    }
  }

  const saveAll = async () => {
    if (!result || savingAll) return
    setSavingAll(true)
    let failures = 0
    for (let i = 0; i < result.records.length; i++) {
      if (result.records[i].saved) continue
      try { await saveRecord(i) } catch { failures++ }
    }
    setSavingAll(false)
    setToast(failures ? { msg: failures + ' record(s) need review', type: 'error' } : { msg: 'All records saved' })
  }

  return (
    <div className="module-page" style={{ background: 'var(--bg0)', minHeight: '100dvh', paddingBottom: 100 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <div style={{ padding: '20px 20px 14px 60px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="var(--t3)" />
          <span style={{ fontFamily: SF, fontSize: 13, color: 'var(--t3)' }}>Apps</span>
        </Link>
        <h1 style={{ fontFamily: SF, fontSize: 22, fontWeight: 700, color: 'var(--t1)' }}>Smart Parse</h1>
        <p style={{ fontFamily: SF, fontSize: 12, color: 'var(--t2)', marginTop: 3 }}>Paste an email, brief or transcript. Cortex extracts records for you to review before saving.</p>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <textarea
          value={text}
          onChange={e => { setText(e.target.value); setError(null) }}
          placeholder="Paste a site note, client email, voice transcript or commercial brief..."
          rows={8}
          style={{ width: '100%', boxSizing: 'border-box', background: 'var(--surface-raised)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, color: 'var(--t1)', padding: 14, fontFamily: SF, fontSize: 14, lineHeight: 1.5, resize: 'vertical', outline: 'none' }}
        />
        <button
          type="button"
          onClick={parse}
          disabled={busy || text.trim().length < 10}
          style={{ padding: '12px 16px', borderRadius: 12, border: 'none', background: '#8b5cf6', color: '#fff', fontFamily: SF, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: busy || text.trim().length < 10 ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
        >
          <IcSpark size={16} color="#fff" /> {busy ? 'Parsing...' : 'Extract records'}
        </button>
        {error && <div style={{ color: '#ef4444', fontFamily: SF, fontSize: 12 }}>{error}</div>}

        {result && (
          <>
            <div style={{ background: 'rgba(139,92,246,0.09)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontFamily: SF, fontSize: 11, color: '#a78bfa', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Summary</div>
              <div style={{ fontFamily: SF, fontSize: 13, color: 'var(--t1)', marginTop: 4 }}>{result.summary || 'Records extracted'}</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: SF, fontSize: 12, color: 'var(--t2)' }}>{result.records.length} record{result.records.length === 1 ? '' : 's'} found</span>
              {result.records.length > 0 && (
                <button type="button" onClick={saveAll} disabled={savingAll} style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 9, padding: '7px 10px', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {savingAll ? 'Saving...' : 'Save all ready'}
                </button>
              )}
            </div>

            {result.records.map((rec, index) => (
              <div key={index} style={{ background: 'var(--surface-raised)', borderRadius: 14, border: '0.5px solid rgba(255,255,255,0.08)', padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <div style={{ fontFamily: SF, fontSize: 10, fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 0.6 }}>{rec.type} · {Math.round(rec.confidence * 100)}%</div>
                    <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginTop: 3 }}>{rec.title}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => saveRecord(index).catch(() => {})}
                    disabled={rec.saved}
                    style={{ flexShrink: 0, height: 34, padding: '0 11px', borderRadius: 9, background: rec.saved ? 'rgba(16,185,129,0.15)' : '#2563eb', border: 'none', color: rec.saved ? '#10b981' : '#fff', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: rec.saved ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    {rec.saved && <IcCheck size={12} color="#10b981" />}
                    {rec.saved ? 'Saved' : 'Save'}
                  </button>
                </div>
                {rec.reason && <div style={{ fontFamily: SF, fontSize: 11, color: 'var(--t2)', marginTop: 6 }}>{rec.reason}</div>}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 9 }}>
                  {Object.entries(rec.fields || {}).slice(0, 8).map(([key, value]) => (
                    <span key={key} style={{ fontFamily: SF, fontSize: 10, color: 'var(--t2)', background: 'rgba(255,255,255,0.05)', padding: '3px 6px', borderRadius: 5 }}>
                      {key}: {String(value)}
                    </span>
                  ))}
                </div>
                {rec.saveError && <div style={{ fontFamily: SF, fontSize: 11, color: '#ef4444', marginTop: 8 }}>{rec.saveError}</div>}
              </div>
            ))}
          </>
        )}
      </div>
      <TabBar />
    </div>
  )
}
