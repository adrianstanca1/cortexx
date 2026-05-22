'use client'

import { useState, useRef } from 'react'
import { IcBot, IcSpark, IcSend, IcCheck, IcClock } from '../ui/Icons'
import type { DashboardData } from '@/lib/types'

interface AIForwardProps {
  accent?: string
  data?: DashboardData | null
}

export default function AIForward({ accent = '#f59e0b', data }: AIForwardProps) {
  const [dismissed, setDismissed] = useState<string[]>([])
  const [snoozed, setSnoozed] = useState<Record<string, number>>({}) // id → unsnooze timestamp
  const [aiQuery, setAiQuery] = useState('')
  const [aiResponse, setAiResponse] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const activities = data?.activities || []
  const invoices = data?.invoices || []
  const tasks = data?.tasks || []
  const now = Date.now()

  const briefings = activities.slice(0, 3).map(a => `${a.actorName} ${a.action}${a.detail ? ` — ${a.detail}` : ''}${a.project ? ` · ${a.project.name}` : ''}`)

  type Decision = { id: string; title: string; detail: string; urgency: 'low' | 'medium' | 'high' }
  const allDecisions: Decision[] = [
    ...invoices
      .filter(i => i.status === 'overdue' || i.status === 'sent')
      .map(i => ({
        id: `inv-${i.id}`,
        title: i.status === 'overdue' ? `${i.number} is overdue — chase client` : `${i.number} ready to review`,
        detail: `${i.project?.name || i.clientName} · £${i.amount.toLocaleString()}`,
        urgency: (i.status === 'overdue' ? 'high' : 'medium') as 'low' | 'medium' | 'high',
      })),
    ...tasks
      .filter(t => t.priority === 'critical' || t.priority === 'high')
      .slice(0, 2)
      .map(t => ({
        id: `task-${t.id}`,
        title: t.title,
        detail: `${t.project?.name || 'No project'}${t.dueDate ? ` · Due ${new Date(t.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}`,
        urgency: (t.priority === 'critical' ? 'high' : 'medium') as 'low' | 'medium' | 'high',
      })),
  ].filter(d => !dismissed.includes(d.id) && !(snoozed[d.id] && snoozed[d.id] > now)).slice(0, 4)

  const snoozeItem = (id: string) => {
    setSnoozed(prev => ({ ...prev, [id]: now + 30 * 60 * 1000 })) // 30 min
  }

  const handleAsk = async () => {
    const q = aiQuery.trim()
    if (!q) return
    setAiLoading(true)
    setAiResponse(null)

    // Build context-aware response from real data
    await new Promise(r => setTimeout(r, 700))
    const activeSites = (data?.projects || []).filter(p => p.status === 'active').length
    const openTasks = tasks.length
    const owed = data?.stats?.owed ?? 0
    const overdueInvoices = invoices.filter(i => i.status === 'overdue').length
    const hoursThisWeek = data?.stats?.hoursThisWeek ?? 0

    let response = ''
    const ql = q.toLowerCase()
    if (ql.includes('task') || ql.includes('todo') || ql.includes('do')) {
      const topTask = tasks[0]
      response = topTask
        ? `You have ${openTasks} open task${openTasks !== 1 ? 's' : ''}. Top priority: "${topTask.title}"${topTask.project ? ` on ${topTask.project.name}` : ''}.`
        : 'No open tasks — all clear!'
    } else if (ql.includes('money') || ql.includes('invoice') || ql.includes('payment') || ql.includes('owed') || ql.includes('cash')) {
      response = `£${(owed/1000).toFixed(0)}k outstanding across ${invoices.filter(i => i.status !== 'paid').length} invoices.${overdueInvoices > 0 ? ` ⚠ ${overdueInvoices} overdue.` : ' All current.'}`
    } else if (ql.includes('site') || ql.includes('project')) {
      response = `${activeSites} active site${activeSites !== 1 ? 's' : ''}. ${(data?.projects || []).map(p => `${p.name} (${p.progress}%)`).join(', ')}.`
    } else if (ql.includes('team') || ql.includes('staff') || ql.includes('hours')) {
      response = `${(data?.team || []).length} team members logged ${hoursThisWeek}h this week. ${(data?.team || []).filter(m => m.onSite).length} on site now.`
    } else if (ql.includes('status') || ql.includes('summary') || ql.includes('overview')) {
      response = `${activeSites} active sites · ${openTasks} open tasks · £${(owed/1000).toFixed(0)}k owed · ${hoursThisWeek}h logged this week.`
    } else {
      response = `${activeSites} active sites running. ${openTasks} open tasks — top: "${tasks[0]?.title || 'none'}". £${(owed/1000).toFixed(0)}k outstanding.`
    }

    setAiResponse(response)
    setAiQuery('')
    setAiLoading(false)

    // Log the query as activity
    fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorName: 'Cortex AI', actorType: 'ai', action: `answered: "${q}"`, iconType: 'spark' }),
    }).catch(() => {})
  }

  return (
    <div style={{ padding: '16px 20px 100px' }}>
      {/* Morning briefing card */}
      <div style={{ borderRadius: 20, background: 'linear-gradient(135deg, rgba(37,99,235,0.2) 0%, rgba(139,92,246,0.15) 100%)', border: '1px solid rgba(96,165,250,0.25)', padding: '20px', marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(96,165,250,0.1)', filter: 'blur(20px)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(37,99,235,0.3)', border: '1px solid rgba(96,165,250,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IcBot size={18} color="#60a5fa" />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#eef3fa', fontFamily: 'var(--font-system)' }}>Cortex Morning Briefing</p>
            <p style={{ fontSize: 11, color: '#60a5fa', fontFamily: 'var(--font-system)' }}>Updated just now</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {briefings.length > 0 ? briefings.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ marginTop: 2, display: 'inline-flex' }}><IcSpark size={12} color="#60a5fa" /></span>
              <p style={{ fontSize: 13, color: '#c7daf5', fontFamily: 'var(--font-system)', lineHeight: 1.4, flex: 1 }}>{b}</p>
            </div>
          )) : (
            <p style={{ fontSize: 13, color: '#c7daf5', fontFamily: 'var(--font-system)' }}>All sites running smoothly today.</p>
          )}
        </div>
      </div>

      {/* Decision queue */}
      <p style={{ fontSize: 11, fontWeight: 700, color: '#52749a', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-system)', marginBottom: 10 }}>
        Decision queue {allDecisions.length > 0 && `· ${allDecisions.length}`}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {allDecisions.length > 0 ? allDecisions.map((d) => (
          <div key={d.id} style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#eef3fa', fontFamily: 'var(--font-system)' }}>{d.title}</p>
                <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: 'var(--font-system)' }}>{d.detail}</p>
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 7px', borderRadius: 99, background: d.urgency === 'high' ? 'rgba(239,68,68,0.15)' : d.urgency === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)', color: d.urgency === 'high' ? '#ef4444' : d.urgency === 'medium' ? '#f59e0b' : '#10b981', fontFamily: 'var(--font-system)' }}>
                {d.urgency}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => setDismissed(prev => [...prev, d.id])} style={{ flex: 1, padding: '8px 0', borderRadius: 10, background: '#10b98122', border: '1px solid #10b98144', fontSize: 13, fontWeight: 600, color: '#10b981', cursor: 'pointer', fontFamily: 'var(--font-system)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <IcCheck size={13} color="#10b981" /> Done
              </button>
              <button onClick={() => snoozeItem(d.id)} style={{ flex: 1, padding: '8px 0', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 13, fontWeight: 600, color: '#8ea8c5', cursor: 'pointer', fontFamily: 'var(--font-system)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <IcClock size={13} color="#8ea8c5" /> Snooze 30m
              </button>
            </div>
          </div>
        )) : (
          <div style={{ padding: '20px 0', textAlign: 'center', color: '#52749a', fontFamily: 'var(--font-system)', fontSize: 13 }}>Queue clear — great work!</div>
        )}
      </div>

      {/* AI response */}
      {aiResponse && (
        <div style={{ marginBottom: 12, padding: '12px 14px', borderRadius: 14, background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <IcSpark size={14} color="#60a5fa" />
            <p style={{ fontSize: 13, color: '#c7daf5', fontFamily: 'var(--font-system)', lineHeight: 1.4, flex: 1 }}>{aiResponse}</p>
          </div>
        </div>
      )}

      {/* Ask Cortex bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <IcBot size={18} color="#60a5fa" />
        <input
          ref={inputRef}
          value={aiQuery}
          onChange={e => setAiQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAsk()}
          placeholder="Ask Cortex anything…"
          style={{ background: 'none', border: 'none', outline: 'none', color: '#eef3fa', fontFamily: 'var(--font-system)', fontSize: 13, flex: 1 }}
        />
        <button
          onClick={handleAsk}
          disabled={aiLoading || !aiQuery.trim()}
          style={{ width: 30, height: 30, borderRadius: 9, background: aiQuery.trim() ? '#2563eb' : 'rgba(37,99,235,0.3)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: aiQuery.trim() ? 'pointer' : 'default', flexShrink: 0 }}
        >
          {aiLoading ? <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #fff', borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite', display: 'block' }} /> : <IcSend size={14} color="#fff" />}
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
