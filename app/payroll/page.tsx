'use client'

import { useEffect, useRef, useState } from 'react'
import ModuleShell from '@/components/ui/ModuleShell'
import ModuleRecordModal from '@/components/ui/ModuleRecordModal'

interface Row { id: string; createdAt: string; [k: string]: unknown }

export default function PayrollRunPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Row | null>(null)
  const [canManageFinancials, setCanManageFinancials] = useState(false)
  // Bumped on every revocation so responses that resolve after a 403
  // cannot restore revoked state (stale-response guard).
  const accessGeneration = useRef(0)

  const revokeFinancialAccess = (message = 'Financial admin permission required') => {
    accessGeneration.current += 1
    setCanManageFinancials(false)
    setRows([])
    setSelected(null)
    setError(message)
  }

  useEffect(() => {
    const generation = accessGeneration.current
    fetch('/api/payroll')
      .then(r => {
        if (!r.ok) {
          if (r.status === 403) revokeFinancialAccess()
          return r.json().then(d => { throw new Error(d.error || 'Failed') })
        }
        return r.json()
      })
      .then(d => {
        if (accessGeneration.current !== generation) return
        setCanManageFinancials(true)
        setRows(d.items || [])
      })
      .catch(e => { if (accessGeneration.current === generation) setError(e instanceof Error ? e.message : 'Failed') })
      .finally(() => setLoading(false))
  }, [])

  const create = async () => {
    const value = window.prompt('New payroll — short label')
    if (!value) return
    const generation = accessGeneration.current
    const res = await fetch('/api/payroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodStart: value }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      if (res.status === 403) revokeFinancialAccess(d.error || 'Financial admin permission required')
      window.alert(d.error || 'Failed to create')
      return
    }
    const created = await res.json()
    if (accessGeneration.current !== generation) return
    setRows(prev => [created.item, ...prev])
    // Open the edit modal on the new record so the user can fill in
    // the remaining fields without having to find + click the row.
    setSelected(created.item)
  }

  return (
    <ModuleShell
      title="Payroll"
      tagline="PAYE + CIS submission helper"
      action={canManageFinancials ? { label: 'New', onClick: create } : null}
    >
      {loading ? (
        <div style={{ color: 'var(--t3)', fontSize: 13, fontFamily: 'var(--font-system)' }}>Loading…</div>
      ) : error ? (
        <div style={{ color: '#ef4444', fontSize: 13, fontFamily: 'var(--font-system)' }}>{error}</div>
      ) : rows.length === 0 ? (
        <div style={{ color: 'var(--t3)', fontSize: 13, fontFamily: 'var(--font-system)', padding: 32, textAlign: 'center' }}>
          No records yet. Click <strong style={{ color: '#f59e0b' }}>New</strong> to add the first one.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(r => (
            <li
              key={r.id}

              style={{ background: 'var(--surface-raised)', borderRadius: 10, padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.07)', fontFamily: 'var(--font-system)', fontSize: 13, color: 'var(--t1)', cursor: 'pointer' }}
            ><div role="button" tabIndex={0} onClick={() => setSelected(r)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click() } }}>
              <div>{[r.periodStart, r.periodEnd, r.grossTotal].filter(Boolean).join(' · ') || r.id}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>
                {new Date(r.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div></li>
          ))}
        </ul>
      )}

      <ModuleRecordModal
        slug="payroll"
        record={canManageFinancials ? selected : null}
        onClose={() => setSelected(null)}
        onForbidden={() => revokeFinancialAccess()}
        onSaved={next => { if (canManageFinancials) setRows(prev => prev.map(r => r.id === next.id ? next : r)) }}
        onDeleted={id => { if (canManageFinancials) setRows(prev => prev.filter(r => r.id !== id)) }}
      />
    </ModuleShell>
  )
}
