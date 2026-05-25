'use client'

/**
 * Vera CEO — AI-driven exec briefing. Daily summary of what changed
 * across the workspace + actionable nudges. Wraps /ask Cortex with a
 * pre-filled exec-briefing prompt; saves the user from typing one.
 *
 * Current shape is the briefing UI + a button to expand into Ask.
 * Full agentic capability (Vera taking write actions) is gated behind
 * Pro/Enterprise plans and not yet wired.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import { IcChevL, IcSpark, IcArrowRight } from '@/components/ui/Icons'

interface Briefing {
  generatedAt: string
  summary: string
  highlights: { label: string; value: string }[]
  nudges: string[]
}

export default function VeraCeoPage() {
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Reuse dashboard data to build a quick local briefing — no extra
    // API call needed. When we ship a dedicated /api/vera/briefing
    // endpoint that asks the LLM for a summary, swap this out.
    fetch('/api/dashboard')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) { setError('Failed to load workspace data'); return }
        const projects = d.projects || []
        const tasks = d.tasks || []
        const overdueInvoices = (d.invoices || []).filter((i: { status: string }) => i.status === 'overdue').length
        const openSnags = (d.snags || []).filter((s: { status: string }) => s.status !== 'closed').length
        setBriefing({
          generatedAt: new Date().toISOString(),
          summary: `You have ${projects.length} active project${projects.length === 1 ? '' : 's'}, ${tasks.length} open task${tasks.length === 1 ? '' : 's'}, and ${overdueInvoices + openSnags} item${(overdueInvoices + openSnags) === 1 ? '' : 's'} needing attention.`,
          highlights: [
            { label: 'Active projects', value: String(projects.length) },
            { label: 'Open tasks', value: String(tasks.length) },
            { label: 'Overdue invoices', value: String(overdueInvoices) },
            { label: 'Open snags', value: String(openSnags) },
          ],
          nudges: [
            ...(overdueInvoices > 0 ? [`Chase ${overdueInvoices} overdue invoice${overdueInvoices === 1 ? '' : 's'}`] : []),
            ...(openSnags > 5 ? [`${openSnags} snags accumulating — schedule a close-out session`] : []),
            ...(tasks.length > 20 ? ['Task backlog growing — consider bulk-archiving stale ones'] : []),
          ],
        })
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 12 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>All apps</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IcSpark size={24} color="#8b5cf6" />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)', margin: 0 }}>
            Vera CEO
          </h1>
        </div>
        <p style={{ fontSize: 13, color: '#8ea8c5', fontFamily: 'var(--font-system)', margin: '4px 0 0' }}>
          AI-driven exec briefing. {briefing && `Generated ${new Date(briefing.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.`}
        </p>
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading && <p style={{ color: '#52749a', padding: 40, textAlign: 'center', fontFamily: 'var(--font-system)', fontSize: 13 }}>Generating briefing…</p>}
        {error && <p style={{ color: '#ef4444', padding: 40, textAlign: 'center', fontFamily: 'var(--font-system)', fontSize: 13 }}>{error}</p>}

        {briefing && (
          <>
            <div style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.04))', border: '0.5px solid rgba(139,92,246,0.3)', borderRadius: 14, padding: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px', fontFamily: 'var(--font-system)' }}>Summary</p>
              <p style={{ fontSize: 15, color: '#eef3fa', margin: 0, lineHeight: 1.5, fontFamily: 'var(--font-system)' }}>{briefing.summary}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {briefing.highlights.map(h => (
                <div key={h.label} style={{ background: '#152641', borderRadius: 10, padding: 12, border: '0.5px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ fontSize: 11, color: '#52749a', fontFamily: 'var(--font-system)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h.label}</div>
                  <div style={{ fontSize: 22, color: '#eef3fa', fontWeight: 700, fontFamily: 'ui-monospace, monospace', marginTop: 4 }}>{h.value}</div>
                </div>
              ))}
            </div>

            {briefing.nudges.length > 0 && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px', fontFamily: 'var(--font-system)' }}>Nudges</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {briefing.nudges.map((n, i) => (
                    <li key={i} style={{ background: '#152641', borderRadius: 10, padding: '10px 12px', border: '0.5px solid rgba(255,255,255,0.07)', fontSize: 13, color: '#eef3fa', fontFamily: 'var(--font-system)' }}>
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Link href="/ask" style={{ background: '#8b5cf6', color: '#06101e', borderRadius: 12, padding: '14px 16px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'var(--font-system)', fontSize: 14, fontWeight: 700 }}>
              Ask Vera anything
              <IcArrowRight size={16} color="#06101e" />
            </Link>
          </>
        )}
      </div>

      <TabBar />
    </div>
  )
}
