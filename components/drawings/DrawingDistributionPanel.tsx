'use client'

import { useCallback, useEffect, useState } from 'react'

type Revision = { id: string; revision: string }
type Recipient = { id: string; email: string; name: string | null; acknowledgedAt: string | null; acknowledgedBy: string | null }
type Distribution = { id: string; purpose: string; message: string | null; issuedAt: string; revision: Revision; recipients: Recipient[] }
type Permissions = { issue: boolean; acknowledge: boolean; acknowledgeForOthers: boolean; email: string }
const field: React.CSSProperties = { width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--t3)', background: 'var(--bg2)', color: 'var(--t1)', boxSizing: 'border-box' }
const button: React.CSSProperties = { padding: '10px 12px', minHeight: 44, borderRadius: 8, border: '1px solid var(--t3)', background: 'var(--bg2)', color: 'var(--t1)', cursor: 'pointer' }
const date = (value: string) => new Date(value).toLocaleString('en-GB')

export default function DrawingDistributionPanel({ drawingId, revisions }: { drawingId: string; revisions: Revision[] }) {
  const [items, setItems] = useState<Distribution[]>([])
  const [permissions, setPermissions] = useState<Permissions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingOnly, setPendingOnly] = useState(false)
  const [revisionId, setRevisionId] = useState('')
  const [purpose, setPurpose] = useState('For construction')
  const [recipients, setRecipients] = useState('')
  const [message, setMessage] = useState('')
  const selectedRevision = revisions.some(r => r.id === revisionId) ? revisionId : revisions[0]?.id || ''
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/drawings/${drawingId}/distributions`, { signal })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load drawing issues')
      if (!signal?.aborted) { setItems(data.distributions); setPermissions(data.permissions) }
    } catch (e) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : 'Could not load drawing issues')
    } finally { if (!signal?.aborted) setLoading(false) }
  }, [drawingId])
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort() }, [load])

  async function issue() {
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/drawings/${drawingId}/distributions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revisionId: selectedRevision, purpose, message, recipients: recipients.split(/[\n,;]+/).map(email => ({ email: email.trim() })).filter(r => r.email) }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not issue revision')
      setRecipients(''); setMessage(''); await load()
      setNotice('Issue recorded. Download the transmittal to share with recipients; no email has been sent.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not issue revision') }
    finally { setBusy(false) }
  }
  async function acknowledge(distributionId: string, recipientId: string) {
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/drawing-distributions/${distributionId}/recipients/${recipientId}/acknowledge`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Acknowledgement failed')
      await load(); setNotice('Acknowledgement recorded.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Acknowledgement failed') }
    finally { setBusy(false) }
  }
  async function download(id: string) {
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/drawing-distributions/${id}/transmittal`)
      if (!response.ok) throw new Error((await response.json()).error || 'Download failed')
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a'); link.href = url; link.download = `transmittal-${id}.pdf`
      document.body.appendChild(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) { setError(e instanceof Error ? e.message : 'Download failed') }
    finally { setBusy(false) }
  }
  const total = items.reduce((n, d) => n + d.recipients.length, 0)
  const pending = items.reduce((n, d) => n + d.recipients.filter(r => !r.acknowledgedAt).length, 0)
  const visible = pendingOnly ? items.filter(d => d.recipients.some(r => !r.acknowledgedAt)) : items
  return <section aria-label="Drawing issues and transmittals" style={{ background: 'var(--bg3)', borderRadius: 12, padding: 14, display: 'grid', gap: 12 }}>
    <h2 style={{ fontSize: 16, margin: 0 }}>Issues & transmittals</h2>
    {loading && <p role="status">Loading drawing issues…</p>}
    {error && <div role="alert"><p>{error}</p><button type="button" style={button} onClick={() => void load()} disabled={busy}>Retry loading issues</button></div>}
    {notice && <p role="status" style={{ fontSize: 12 }}>{notice}</p>}
    {!loading && <>
      <p style={{ margin: 0, fontSize: 12 }}>{items.length} issues · {total - pending}/{total} acknowledged · {pending} pending</p>
      {permissions?.issue && <details>
        <summary style={{ cursor: 'pointer', padding: '10px 0' }}>Issue a revision</summary>
        {revisions.length === 0 ? <p>Upload a revision before issuing it.</p> : <div style={{ display: 'grid', gap: 10 }}>
          <label>Revision<select aria-label="Revision to issue" style={field} value={selectedRevision} onChange={e => setRevisionId(e.target.value)}>{revisions.map(r => <option key={r.id} value={r.id}>Rev {r.revision}</option>)}</select></label>
          <label>Purpose<select aria-label="Distribution purpose" style={field} value={purpose} onChange={e => setPurpose(e.target.value)}>{['For construction', 'For information', 'For approval', 'For review', 'As built'].map(p => <option key={p}>{p}</option>)}</select></label>
          <label>Recipient emails<textarea style={field} rows={2} value={recipients} onChange={e => setRecipients(e.target.value)} placeholder="Separate emails with commas or new lines" /></label>
          <label>Issue instructions<textarea style={field} rows={2} maxLength={2000} value={message} onChange={e => setMessage(e.target.value)} /></label>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--t2)' }}>Records the issue and creates a downloadable transmittal. Email is not sent automatically.</p>
          <button type="button" style={button} disabled={busy || !selectedRevision || !recipients.trim()} onClick={issue}>{busy ? 'Working…' : 'Issue revision'}</button>
        </div>}
      </details>}
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44 }}><input type="checkbox" checked={pendingOnly} onChange={e => setPendingOnly(e.target.checked)} />Pending acknowledgements only</label>
      {visible.length === 0 && <p style={{ fontSize: 12 }}>{pendingOnly ? 'No pending acknowledgements.' : 'No revisions have been issued yet.'}</p>}
      {visible.map(d => <article key={d.id} style={{ border: '1px solid var(--t3)', borderRadius: 10, padding: 12, display: 'grid', gap: 8, overflowWrap: 'anywhere' }}>
        <strong>Rev {d.revision.revision} · {d.purpose}</strong>
        <small>Issued {date(d.issuedAt)}</small>
        <small>Reference: {d.id}</small>
        {d.message && <p style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12 }}>{d.message}</p>}
        <button type="button" disabled={busy} style={button} onClick={() => void download(d.id)} aria-label={`Download transmittal for revision ${d.revision.revision}`}>Download transmittal PDF</button>
        {d.recipients.filter(r => !pendingOnly || !r.acknowledgedAt).map(r => <div key={r.id} style={{ borderTop: '1px solid var(--t3)', paddingTop: 8, fontSize: 12 }}>
          <div>{r.name ? `${r.name} · ` : ''}{r.email}</div>
          {r.acknowledgedAt ? <div>Acknowledged {date(r.acknowledgedAt)}{r.acknowledgedBy && ` · Recorded by ${r.acknowledgedBy}`}</div> : <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
            <span>Awaiting acknowledgement</span>
            {permissions?.acknowledge && (permissions.acknowledgeForOthers || permissions.email === r.email.toLowerCase()) && <button type="button" style={button} disabled={busy} onClick={() => void acknowledge(d.id, r.id)}>{permissions.email === r.email.toLowerCase() ? 'Acknowledge receipt' : 'Record acknowledgement'}</button>}
          </div>}
        </div>)}
      </article>)}
    </>}
  </section>
}
