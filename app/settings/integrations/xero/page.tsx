'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { IcChevL } from '@/components/ui/Icons'

type XeroConnection = {
  id: string
  tenantId: string | null
  tenantName: string | null
  status: string
  scopes: string[]
  settings: Record<string, unknown>
  lastConnectedAt: string | null
  lastHealthAt: string | null
  lastHealthError: string | null
  lastSyncAt: string | null
  lastSyncStatus: string | null
  lastSyncError: string | null
  importedCount: number
}
type State = { platformConfigured: boolean; missingPlatformConfig: string[]; connection: XeroConnection | null }

const card: React.CSSProperties = { background: 'var(--surface-raised)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 16 }
const input: React.CSSProperties = { background: '#071525', color: 'var(--t1)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, padding: '9px 10px', fontSize: 13 }
const button: React.CSSProperties = { border: 0, borderRadius: 10, padding: '10px 14px', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }

export default function XeroIntegrationPage() {
  const [state, setState] = useState<State | null>(null)
  const [busy, setBusy] = useState('')
  const [maxPages, setMaxPages] = useState(5)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/integrations/xero', { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Failed to load Xero integration')
    setState(data)
    const configured = Number(data.connection?.settings?.maxPages || 5)
    setMaxPages(Number.isFinite(configured) ? Math.max(1, Math.min(10, Math.trunc(configured))) : 5)
  }, [])

  useEffect(() => {
    void load().catch(error => setMessage({ kind: 'err', text: error.message }))
    const qs = new URLSearchParams(window.location.search)
    if (qs.get('connected') === '1') setMessage({ kind: 'ok', text: 'Xero connected successfully.' })
    if (qs.get('error')) setMessage({ kind: 'err', text: `Xero connection failed: ${qs.get('error')}` })
  }, [load])

  async function action(name: string, fn: () => Promise<string | void>) {
    setBusy(name); setMessage(null)
    try {
      const text = await fn()
      if (text) setMessage({ kind: 'ok', text })
      await load()
    } catch (error) {
      setMessage({ kind: 'err', text: error instanceof Error ? error.message : 'Action failed' })
    } finally { setBusy('') }
  }

  const connected = state?.connection?.status === 'connected'
  return (
    <main style={{ background: 'var(--bg0)', minHeight: '100dvh', color: 'var(--t1)', padding: '20px 20px 100px 60px', fontFamily: 'var(--font-system)' }}>
      <Link href="/settings" style={{ color: 'var(--t2)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 14 }}><IcChevL size={18} color="var(--t2)" />Settings</Link>
      <h1 style={{ fontSize: 26, margin: '0 0 4px' }}>Xero accounting</h1>
      <p style={{ color: 'var(--t2)', maxWidth: 760, lineHeight: 1.55 }}>Connect this company to Xero and import bank transactions into Cortexx reconciliation. This release is intentionally read-only: Cortexx does not create or modify Xero invoices, bills, contacts or payments.</p>

      {message && <div role={message.kind === 'err' ? 'alert' : 'status'} style={{ margin: '14px 0', padding: '11px 14px', borderRadius: 10, background: message.kind === 'ok' ? 'rgba(16,185,129,.14)' : 'rgba(239,68,68,.14)', color: message.kind === 'ok' ? '#34d399' : '#f87171' }}>{message.text}</div>}

      {!state ? <p style={{ color: 'var(--t2)' }}>Loading…</p> : !state.platformConfigured ? (
        <section style={card}>
          <h2 style={{ marginTop: 0, fontSize: 17 }}>Platform setup required</h2>
          <p style={{ color: '#c5d4e7' }}>The Cortexx deployment needs a Xero OAuth app before companies can connect. Missing configuration: <strong>{state.missingPlatformConfig.join(', ')}</strong>.</p>
          <p style={{ color: 'var(--t2)', fontSize: 13 }}>Credentials and rotating OAuth tokens stay server-side; no token is stored in the browser.</p>
        </section>
      ) : (
        <div style={{ display: 'grid', gap: 14, maxWidth: 820 }}>
          <section style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Connection</div>
                <h2 style={{ margin: '5px 0 3px', fontSize: 18 }}>{state.connection?.tenantName || 'Not connected'}</h2>
                <div style={{ color: connected ? '#34d399' : '#f59e0b', fontSize: 13 }}>{state.connection?.status || 'disconnected'}</div>
              </div>
              {!connected ? <button style={button} disabled={!!busy} onClick={() => void action('connect', async () => {
                const res = await fetch('/api/integrations/xero/connect', { method: 'POST' }); const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Connect failed'); window.location.assign(data.authorizeUrl)
              })}>{busy === 'connect' ? 'Preparing…' : 'Connect Xero'}</button> : <button style={{ ...button, background: '#7f1d1d' }} disabled={!!busy} onClick={() => {
                if (window.confirm('Disconnect this company from Xero? Imported bank history and Cortexx reconciliation will be retained.')) void action('disconnect', async () => {
                  const res = await fetch('/api/integrations/xero', { method: 'DELETE' }); const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Disconnect failed'); return data.warning ? `Disconnected locally. ${data.warning}` : 'Xero disconnected.'
                })
              }}>{busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}</button>}
            </div>
            {state.connection?.scopes?.length ? <p style={{ color: 'var(--t3)', fontSize: 11 }}>Granted: {state.connection.scopes.join(' · ')}</p> : null}
          </section>

          <section style={card}>
            <h2 style={{ marginTop: 0, fontSize: 17 }}>Bank import</h2>
            <p style={{ color: 'var(--t2)', fontSize: 13, lineHeight: 1.55 }}>Imports Xero bank transactions into the canonical Cortexx bank ledger. Existing matches and allocations are never overwritten. Repeat imports are idempotent by Xero transaction ID.</p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ color: '#c5d4e7', fontSize: 13 }}>Max pages per run <input aria-label="Max Xero pages per run" type="number" min={1} max={10} value={maxPages} onChange={e => setMaxPages(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} style={{ ...input, width: 70, marginLeft: 6 }} /></label>
              <button style={{ ...button, background: '#1d4ed8' }} disabled={!!busy} onClick={() => void action('save', async () => {
                const res = await fetch('/api/integrations/xero', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ maxPages }) }); const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Save failed'); return 'Import limit saved.'
              })}>Save limit</button>
            </div>
            <div style={{ color: 'var(--t2)', fontSize: 13, lineHeight: 1.7, marginTop: 12 }}>
              Imported transactions: {state.connection?.importedCount || 0}<br />
              Last import: {state.connection?.lastSyncAt ? new Date(state.connection.lastSyncAt).toLocaleString('en-GB') : 'never'}{state.connection?.lastSyncStatus ? ` · ${state.connection.lastSyncStatus}` : ''}
            </div>
            {state.connection?.lastSyncError && <p style={{ color: '#f87171', fontSize: 12 }}>Last import error: {state.connection.lastSyncError}</p>}
            <button style={{ ...button, marginTop: 12 }} disabled={!connected || !!busy} onClick={() => void action('sync', async () => {
              const res = await fetch('/api/integrations/xero/sync', { method: 'POST' }); const data = await res.json();
              if (!res.ok) throw new Error(data.retryAfter ? `${data.error}; retry in ${data.retryAfter}s` : data.error || 'Import failed')
              return `Bank import complete: ${data.created} new, ${data.updated} updated, ${data.unchanged} unchanged${data.bounded ? ' (page limit reached)' : ''}.`
            })}>{busy === 'sync' ? 'Importing…' : 'Import bank transactions'}</button>
          </section>

          <section style={card}>
            <h2 style={{ marginTop: 0, fontSize: 17 }}>Connection health</h2>
            <div style={{ color: 'var(--t2)', fontSize: 13, lineHeight: 1.6 }}>Last health check: {state.connection?.lastHealthAt ? new Date(state.connection.lastHealthAt).toLocaleString('en-GB') : 'never'}</div>
            {state.connection?.lastHealthError && <p style={{ color: '#f87171', fontSize: 12 }}>{state.connection.lastHealthError}</p>}
            <button style={{ ...button, background: '#1d4ed8', marginTop: 10 }} disabled={!connected || !!busy} onClick={() => void action('test', async () => {
              const res = await fetch('/api/integrations/xero/test', { method: 'POST' }); const data = await res.json();
              if (!res.ok) throw new Error(data.error || 'Test failed'); return `Connected to ${data.organisation?.name || 'Xero'}.`
            })}>Test connection</button>
          </section>
        </div>
      )}
    </main>
  )
}
