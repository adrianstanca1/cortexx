'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import type { SupplierPerformance } from '@/lib/supplier-performance'

type Report = { supplier: { name: string; archivedAt: string | null }; performance: SupplierPerformance; truncated: boolean; asOf: string }
const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })
const deliveryLabel: Record<string, string> = { on_time: 'On time', late: 'Late', overdue: 'Overdue', not_assessed: 'Not assessed' }

export default function SupplierPerformancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <PerformanceReport key={id} id={id} />
}

function PerformanceReport({ id }: { id: string }) {
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/suppliers/${encodeURIComponent(id)}/performance`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not load supplier performance')
        if (!controller.signal.aborted) setReport(data)
      })
      .catch(e => { if (!controller.signal.aborted) setError(e.message || 'Could not load supplier performance') })
    return () => controller.abort()
  }, [id, retry])
  const p = report?.performance
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-5 pt-16 pb-28">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/suppliers" className="text-sky-300 underline">Back to suppliers</Link>
        <h1 className="text-2xl font-bold">Supplier performance</h1>
        {error ? <div role="alert" className="rounded-xl bg-red-950 p-4">
          <p>{error}</p><button type="button" className="mt-3 underline" onClick={() => { setError(''); setReport(null); setRetry(n => n + 1) }}>Try again</button>
        </div> : !report ? <p role="status">Loading supplier records…</p> : p ? <>
          <h2 className="text-xl font-semibold">{report.supplier.name}{report.supplier.archivedAt ? ' (archived)' : ''}</h2>
          {report.truncated ? <p role="status" className="rounded-xl bg-amber-950 p-4">Showing the latest 1,000 linked orders. These figures do not cover the full history.</p> : null}
          <p className="text-slate-300">Based on linked purchase orders and goods receipts. Values exclude VAT. On-time delivery compares completed deliveries with their expected delivery date, by UTC calendar day.</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['On-time delivery', p.onTimePercent === null ? 'Not enough data' : `${p.onTimePercent}%`, `${p.onTime} of ${p.assessed} assessed deliveries`],
              ['Overdue orders', String(p.overdue), 'Open orders past their expected date'],
              ['Ordered value', gbp.format(p.orderedNet), 'Approved through closed orders'],
              ['Unreceived commitment', gbp.format(p.outstandingNet), 'Open commitment less recorded receipts'],
            ].map(([label, value, detail]) => <div key={label} className="rounded-xl border border-slate-700 bg-slate-900 p-4"><h3 className="text-sm text-slate-300">{label}</h3><p className="my-2 text-xl font-semibold">{value}</p><p className="text-xs text-slate-400">{detail}</p></div>)}
          </div>
          <p className="text-sm text-slate-300">{p.completed} completed deliveries · {p.late} late · {p.missingDates} orders with missing delivery dates · {gbp.format(p.receivedNet)} recorded receipts</p>
          <p className="text-sm text-slate-400">Draft, rejected and cancelled orders are excluded from value and delivery metrics. Missing dates are excluded from the on-time percentage. Unlinked legacy orders are not included.</p>
          {!p.orderCount ? <p className="rounded-xl bg-slate-900 p-6">No linked purchase orders yet. Select this supplier when creating a purchase order to start tracking performance.</p> : <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-left text-sm">
              <caption className="p-3 text-left font-semibold">Evidence: {p.orderCount} linked purchase orders</caption>
              <thead className="bg-slate-900"><tr>{['Order', 'Status', 'Expected', 'Completed', 'Delivery', 'Net value'].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead>
              <tbody>{p.orders.map(order => <tr key={order.id} className="border-t border-slate-800"><td className="p-3"><Link className="text-sky-300 underline" href={`/api/pos/${encodeURIComponent(order.id)}/pdf`}>{order.number}</Link></td><td className="p-3">{order.status.replaceAll('_', ' ')}</td><td className="p-3 whitespace-nowrap">{order.expectedDelivery || 'Unknown'}</td><td className="p-3 whitespace-nowrap">{order.completedDelivery || 'Unknown'}</td><td className="p-3">{deliveryLabel[order.delivery]}</td><td className="p-3 whitespace-nowrap">{gbp.format(order.orderedNet)}</td></tr>)}</tbody>
            </table>
          </div>}
        </> : null}
      </div>
    </main>
  )
}
