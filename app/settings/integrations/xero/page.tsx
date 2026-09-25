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
  lastSyncAt: string | null
  lastSyncStatus: string | null
  lastSyncError: string | null
  linkCount: number
}

type State = {
  platformConfigured: boolean
  missingPlatformConfig: string[]
  connection: XeroConnection | null
}

const card: React.CSSProperties = { background: '#152641', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 16 }
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: '#071525', color: '#eef3fa', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, padding: '10px 12px', fontSize: 13 }
const button: React.CSSProperties = { border: 0, borderRadius: 10, padding: '10px 14px', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }

export default function XeroIntegrationPage() {
  const [state, setState] = useState<State | null>(null)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [settings, setSettings] = useState({ salesAccountCode: '', salesTaxType: '', purchaseAccountCode: '', purchaseTaxType: '', syncBills: false })

  const load = useCallback(async () => {
    const res = await fetch('/api/integrations/xero', { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Failed to load Xero integration')
    setState(data)
    const raw = data.connection?.settings || {}
    setSettings({
      salesAccountCode: String(raw.salesAccountCode || ''),
      salesTaxType: String(raw.salesTaxType || ''),
      purchaseAccountCode: String(raw.purchaseAccountCode || ''),
      purchaseTaxType: String(raw.purchaseTaxType || ''),
      syncBills: raw.syncBills === true,
    })
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
    <main style={{ background: '#06101e', minHeight: '100dvh', color: '#eef3fa', padding: '20px 20px 100px 60px', fontFamily: 'var(--font-system)' }}>
      <Link href="/settings" style={{ color: '#8ea8c5', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 14 }}><IcChevL size={18} color="#8ea8c5" />Settings</Link>
      <h1 style={{ fontSize: 26, margin: '0 0 4px' }}>Xero accounting</h1>
      <p style={{ color: '#8ea8c5', maxWidth: 720, lineHeight: 1.55 }}>Sync Cortexx sales invoices and approved subcontract bills through a tenant-scoped OAuth connection. Cortexx remains the construction ledger; outbound records are created as drafts for accounting review.</p>

      {message && <div role={message.kind === 'err' ? 'alert' : 'status'} style={{ margin: '14px 0', padding: '11px 14px', borderRadius: 10, background: message.kind === 'ok' ? 'rgba(16,185,129,.14)' : 'rgba(239,68,68,.14)', color: message.kind === 'ok' ? '#34d399' : '#f87171' }}>{message.text}</div>}

      {!state ? <p style={{ color: '#8ea8c5' }}>Loading…</p> : !state.platformConfigured ? (
        <section style={card}>
          <h2 style={{ marginTop: 0, fontSize: 17 }}>Platform setup required</h2>
          <p style={{ color: '#c5d4e7' }}>The Cortexx deployment needs a Xero OAuth app before companies can connect. Missing configuration: <strong>{state.missingPlatformConfig.join(', ')}</strong>.</p>
          <p style={{ color: '#8ea8c5', fontSize: 13 }}>No credential is stored in the browser. Configure the deployment secrets, then return here.</p>
        </section>
      ) : (
        <div style={{ display: 'grid', gap: 14, maxWidth: 820 }}>
          <section style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div><div style={{ color: '#8ea8c5', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Connection</div><h2 style={{ margin: '5px 0 3px', fontSize: 18 }}>{state.connection?.tenantName || 'Not connected'}</h2><div style={{ color: connected ? '#34d399' : '#f59e0b', fontSize: 13 }}>{state.connection?.status || 'disconnected'}</div></div>
              {!connected ? <button style={button} disabled={!!busy} onClick={() => void action('connect', async () => { const res = await fetch('/api/integrations/xero/connect', { method: 'POST' }); const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Connect failed'); window.location.assign(data.authorizeUrl) })}>{busy === 'connect' ? 'Preparing…' : 'Connect Xero'}</button> : <button style={{ ...button, background: '#7f1d1d' }} disabled={!!busy} onClick={() => { if (window.confirm('Disconnect this company from Xero? Existing sync history will be retained.')) void action('disconnect', async () => { const res = await fetch('/api/integrations/xero', { method: 'DELETE' }); const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Disconnect failed'); return data.warning ? `Disconnected locally. ${data.warning}` : 'Xero disconnected.' }) }}>{busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}</button>}
            </div>
            {state.connection?.lastSyncError && <p style={{ color: '#f87171', fontSize: 12 }}>Last sync: {state.connection.lastSyncError}</p>}
          </section>

          <section style={card}>
            <h2 style={{ marginTop: 0, fontSize: 17 }}>Account mapping</h2>
            <p style={{ color: '#8ea8c5', fontSize: 13 }}>Use the account codes and tax types from the connected Xero organisation. Sync is blocked until the relevant mapping is present.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
              <label>Sales account code<input aria-label="Sales account code" value={settings.salesAccountCode} onChange={e => setSettings(v => ({ ...v, salesAccountCode: e.target.value }))} style={{ ...input, marginTop: 5 }} /></label>
              <label>Sales tax type<input aria-label="Sales tax type" value={settings.salesTaxType} onChange={e => setSettings(v => ({ ...v, salesTaxType: e.target.value }))} style={{ ...input, marginTop: 5 }} /></label>
              <label>Purchase account code<input aria-label="Purchase account code" value={settings.purchaseAccountCode} onChange={e => setSettings(v => ({ ...v, purchaseAccountCode: e.target.value }))} style={{ ...input, marginTop: 5 }} /></label>
              <label>Purchase tax type<input aria-label="Purchase tax type" value={settings.purchaseTaxType} onChange={e => setSettings(v => ({ ...v, purchaseTaxType: e.target.value }))} style={{ ...input, marginTop: 5 }} /></label>
            </div>
            <label style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}><input type="checkbox" checked={settings.syncBills} onChange={e => setSettings(v => ({ ...v, syncBills: e.target.checked }))} />Sync subcontract bills as Xero drafts</label>
            <button style={{ ...button, marginTop: 12 }} disabled={!!busy} onClick={() => void action('save', async () => { const res = await fetch('/api/integrations/xero', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Save failed'); return 'Xero mappings saved.' })}>{busy === 'save' ? 'Saving…' : 'Save mappings'}</button>
          </section>

          <section style={card}>
            <h2 style={{ marginTop: 0, fontSize: 17 }}>Connection health & sync</h2>
            <div style={{ color: '#8ea8c5', fontSize: 13, lineHeight: 1.6 }}>Linked records: {state.connection?.linkCount || 0}<br />Last sync: {state.connection?.lastSyncAt ? new Date(state.connection.lastSyncAt).toLocaleString('en-GB') : 'never'}{state.connection?.lastSyncStatus ? ` · ${state.connection.lastSyncStatus}` : ''}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <button style={{ ...button, background: '#1d4ed8' }} disabled={!connected || !!busy} onClick={() => void action('test', async () => { const res = await fetch('/api/integrations/xero/test', { method: 'POST' }); const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Test failed'); return `Connected to ${data.organisation?.name || 'Xero'}.` })}>Test connection</button>
              <button style={button} disabled={!connected || !!busy} onClick={() => void action('sync', async () => { const res = await fetch('/api/integrations/xero/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'all' }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Sync failed'); return `Sync ${data.status}: ${data.pushed.length} pushed, ${data.pulled.length} checked, ${data.errors.length} errors.` })}>{busy === 'sync' ? 'Syncing…' : 'Sync now'}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
