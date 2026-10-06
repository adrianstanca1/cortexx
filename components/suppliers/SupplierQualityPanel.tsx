'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { SupplierQuality } from '@/lib/supplier-quality'

type Candidate = { id: string; title: string; status: string; projectId: string; project: { id: string; name: string } }
type Candidates = { sources: Candidate[]; truncated: boolean; purchaseOrders: { id: string; number: string; projectId: string }[]; ordersTruncated: boolean }
const label: Record<string, string> = { open: 'Open defect', closed: 'Closed defect', passed: 'Passed inspection', failed: 'Failed inspection', not_assessed: 'Not assessed', source_unavailable: 'Source not assessable', withdrawn: 'Withdrawn' }
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('en-GB', { timeZone: 'UTC' }) : 'Unknown'
const fieldClass = 'mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100'
const buttonClass = 'rounded-lg border border-slate-600 px-4 py-2 disabled:opacity-50'

export default function SupplierQualityPanel({ supplierId, quality, onSaved }: { supplierId: string; quality: SupplierQuality; onSaved: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [sourceType, setSourceType] = useState('snag')
  const [query, setQuery] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [search, setSearch] = useState(0)
  const [candidates, setCandidates] = useState<Candidates | null>(null)
  const [sourceId, setSourceId] = useState('')
  const [purchaseOrderId, setPurchaseOrderId] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [withdrawId, setWithdrawId] = useState('')
  const [withdrawReason, setWithdrawReason] = useState('')
  const [visible, setVisible] = useState(50)

  useEffect(() => {
    if (!showForm) return
    const controller = new AbortController()
    setCandidates(null)
    setSourceId('')
    setPurchaseOrderId('')
    setError('')
    const params = new URLSearchParams({ sourceType, q: searchQuery })
    fetch(`/api/suppliers/${encodeURIComponent(supplierId)}/quality/sources?${params}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'Could not load evidence sources')
        if (!controller.signal.aborted) setCandidates(data)
      })
      .catch(e => { if (!controller.signal.aborted) setError(e.message || 'Could not load evidence sources') })
    return () => controller.abort()
  }, [supplierId, showForm, sourceType, searchQuery, search])

  const save = async (withdraw: boolean) => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/suppliers/${encodeURIComponent(supplierId)}/quality${withdraw ? '/' + encodeURIComponent(withdrawId) : ''}`, {
        method: withdraw ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withdraw ? { reason: withdrawReason } : { sourceType, sourceId, purchaseOrderId: purchaseOrderId || null, reason }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not save quality evidence')
      setMessage(withdraw ? 'Attribution withdrawn. Its history is retained.' : 'Quality evidence recorded.')
      setWithdrawId('')
      setWithdrawReason('')
      setReason('')
      setShowForm(false)
      onSaved()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save quality evidence') }
    finally { setSaving(false) }
  }
  const selected = candidates?.sources.find(source => source.id === sourceId)
  const orders = candidates?.purchaseOrders.filter(order => order.projectId === selected?.projectId) || []

  return <section aria-labelledby="supplier-quality-heading" className="space-y-4 border-t border-slate-700 pt-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="supplier-quality-heading" className="text-xl font-semibold">Quality and defect evidence</h2>
      <button type="button" className={buttonClass} disabled={saving} onClick={() => { setShowForm(value => !value); setError(''); setMessage('') }}>{showForm ? 'Cancel attribution' : 'Add quality evidence'}</button>
    </div>
    <p className="text-sm text-slate-300">Company Admin attributions link existing defects and quality inspections to this supplier. Figures use the current source status. Withdrawn attributions stay in history and do not affect the figures.</p>
    {quality.truncated && <p role="status" className="rounded-xl bg-amber-950 p-4">Quality figures cover the latest 1,000 attribution records, including withdrawn records. Earlier evidence is excluded.</p>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        ['Open defects', String(quality.openDefects), `${quality.closedDefects} closed defects`],
        ['Overdue defects', String(quality.overdueDefects), `${quality.urgentOpenDefects} open high or critical priority`],
        ['Inspection pass rate', quality.inspectionPassPercent === null ? 'Not enough data' : `${quality.inspectionPassPercent}%`, `${quality.passedInspections} passed of ${quality.assessedInspections} assessed`],
        ['Failed inspections', String(quality.failedInspections), `${quality.unassessedInspections} inspections not assessed`],
      ].map(([title, value, detail]) => <div key={title} className="rounded-xl border border-slate-700 bg-slate-900 p-4"><h3 className="text-sm text-slate-300">{title}</h3><p className="my-2 text-xl font-semibold">{value}</p><p className="text-xs text-slate-400">{detail}</p></div>)}
    </div>
    <p className="text-sm text-slate-400">The pass rate includes completed quality inspections with matching pass/fail status and result. It does not measure defect frequency per delivery or overall supplier quality. {quality.withdrawnCount} withdrawn · {quality.unassessedDefects} defects not assessed · {quality.unavailableSources} sources not assessable.</p>
    {error && <p role="alert" className="rounded-lg bg-red-950 p-3">{error}</p>}
    {message && <p role="status" className="text-emerald-300">{message}</p>}
    {showForm && <form aria-label="Attribute supplier quality evidence" className="space-y-4 rounded-xl border border-slate-600 bg-slate-900 p-4" onSubmit={event => { event.preventDefault(); void save(false) }}>
      <label className="block">Source type<select className={fieldClass} value={sourceType} disabled={saving} onChange={event => setSourceType(event.target.value)}><option value="snag">Defect</option><option value="inspection">Quality inspection</option></select></label>
      <div className="flex flex-wrap items-end gap-3"><label className="grow">Search source title<input className={fieldClass} maxLength={100} value={query} onChange={event => setQuery(event.target.value)} /></label><button type="button" className={buttonClass} disabled={saving} onClick={() => { setSearchQuery(query.trim()); setSearch(value => value + 1) }}>Search sources</button></div>
      {!candidates ? !error && <p role="status">Loading source records…</p> : <>
        {candidates.truncated && <p role="status" className="text-amber-300">Showing the latest 25 matching source records. Search by title to find older records.</p>}
        {!candidates.sources.length && <p role="status">No matching sources available. Existing attributions, including withdrawn ones, are excluded.</p>}
        <label className="block">Source record<select className={fieldClass} required value={sourceId} disabled={saving} onChange={event => { setSourceId(event.target.value); setPurchaseOrderId('') }}><option value="">Select a record</option>{candidates.sources.map(source => <option key={source.id} value={source.id}>{source.title} · {source.project.name} · {source.status.replaceAll('_', ' ')}</option>)}</select></label>
        <label className="block">Purchase order (optional)<select className={fieldClass} value={purchaseOrderId} disabled={!selected || saving} onChange={event => setPurchaseOrderId(event.target.value)}><option value="">No purchase order attributed</option>{orders.map(order => <option key={order.id} value={order.id}>{order.number}</option>)}</select></label>
        <p className="text-xs text-slate-400">Eligible orders belong to this supplier and the source project. {candidates.ordersTruncated ? 'Only the latest 100 eligible supplier orders are available here.' : null}</p>
      </>}
      <label className="block">Why this source is attributable to the supplier<textarea className={fieldClass} required minLength={3} maxLength={2000} rows={3} disabled={saving} value={reason} onChange={event => setReason(event.target.value)} /></label>
      <button type="submit" className={buttonClass} disabled={saving || !sourceId || reason.trim().length < 3}>{saving ? 'Saving…' : 'Record attribution'}</button>
    </form>}
    {withdrawId && <form aria-label="Withdraw supplier attribution" className="space-y-3 rounded-xl border border-amber-700 p-4" onSubmit={event => { event.preventDefault(); void save(true) }}>
      <p>The original attribution and source link will remain in history.</p>
      <label className="block">Withdrawal reason<textarea className={fieldClass} required minLength={3} maxLength={2000} rows={2} value={withdrawReason} disabled={saving} onChange={event => setWithdrawReason(event.target.value)} /></label>
      <div className="flex gap-3"><button type="submit" className={buttonClass} disabled={saving || withdrawReason.trim().length < 3}>{saving ? 'Saving…' : 'Confirm withdrawal'}</button><button type="button" className={buttonClass} disabled={saving} onClick={() => setWithdrawId('')}>Cancel withdrawal</button></div>
    </form>}
    {!quality.evidenceCount ? <p className="rounded-xl bg-slate-900 p-6">No quality evidence attributed yet. Delivery history alone does not establish supplier quality.</p> : <>
      <div className="overflow-x-auto rounded-xl border border-slate-700"><table className="w-full text-left text-sm">
        <caption className="p-3 text-left font-semibold">Quality attribution history: {quality.evidenceCount} records</caption>
        <thead className="bg-slate-900"><tr>{['Source record', 'Assessment', 'Order', 'Attribution', 'History'].map(title => <th key={title} scope="col" className="p-3">{title}</th>)}</tr></thead>
        <tbody>{quality.rows.slice(0, visible).map(row => <tr key={row.id} className="border-t border-slate-800 align-top">
          <td className="p-3">{row.source ? <details><summary className="cursor-pointer text-sky-300">{row.source.title}</summary><div className="mt-2 space-y-1 text-slate-300"><p>{row.source.sourceType === 'snag' ? 'Defect' : 'Quality inspection'} · {row.source.status.replaceAll('_', ' ')}</p><Link href={`/projects/${encodeURIComponent(row.source.project.id)}`} className="underline">{row.source.project.name}</Link><p>{row.source.description || row.source.notes}</p><p>Source reference: {row.source.id}</p><p>Updated {date(row.source.updatedAt)}</p>{row.source.sourceType === 'snag' ? <p>Priority: {row.source.priority || 'Unknown'} · Due {date(row.source.dueDate)} · Closed {date(row.source.closedAt)}</p> : <p>Result: {row.source.overallResult || 'Unknown'} · Completed {date(row.source.completedAt)}</p>}</div></details> : 'Source not assessable'}</td>
          <td className="p-3">{label[row.assessment] || 'Not assessed'}</td>
          <td className="p-3">{row.purchaseOrder ? <a className="text-sky-300 underline" href={`/api/pos/${encodeURIComponent(row.purchaseOrder.id)}/pdf`}>{row.purchaseOrder.number}</a> : 'None attributed'}</td>
          <td className="p-3"><p>{row.reason}</p><p className="mt-2 text-xs text-slate-400">Recorded {date(row.createdAt)}</p></td>
          <td className="p-3">{row.withdrawnAt ? <><p>Withdrawn {date(row.withdrawnAt)}</p><p className="mt-1 text-slate-300">{row.withdrawalReason}</p></> : <button type="button" className="text-amber-300 underline disabled:opacity-50" aria-label={`Withdraw attribution for ${row.source?.title || 'source record'}`} disabled={saving} onClick={() => { setWithdrawId(row.id); setWithdrawReason(''); setError(''); setMessage('') }}>Withdraw attribution</button>}</td>
        </tr>)}</tbody>
      </table></div>
      {visible < quality.rows.length && <button type="button" className={buttonClass} onClick={() => setVisible(value => value + 50)}>Show more evidence ({Math.min(visible, quality.rows.length)} of {quality.rows.length} shown)</button>}
    </>}
  </section>
}
