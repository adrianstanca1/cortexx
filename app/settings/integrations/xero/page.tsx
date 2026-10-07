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
type Account = { id: string | null; code: string; name: string; type: string; enablePaymentsToAccount: boolean }
type TaxRate = { name: string; taxType: string; rate: number | null }
type Mapping = {
  enabled: boolean
  salesAccountCode: string
  salesTaxType: string
  purchaseAccountCode: string
  purchaseTaxType: string
  paymentAccountCode: string
}
type MappingData = { mapping: Mapping; salesAccounts: Account[]; purchaseAccounts: Account[]; paymentAccounts: Account[]; taxRates: TaxRate[] }
type QueueItem = {
  entityType: 'client_invoice' | 'sub_invoice'
  entityId: string
  number: string
  counterparty: string
  project: string | null
  date: string
  amount: number
  localStatus: string
  blocker: string | null
  paymentBlocker?: string | null
  changedSinceSync?: boolean
  writeback: { status: string; externalId?: string | null; lastError?: string | null } | null
  paymentWriteback?: { status: string; externalId?: string | null; lastError?: string | null } | null
}
type QueueData = { connection: { writebackEnabled: boolean; missingScopes: string[] } | null; mapping?: Mapping; items: QueueItem[]; pagination?: { take: number; clientSkip: number; subSkip: number; clientHasMore?: boolean; subHasMore?: boolean; hasMore: boolean; total: number } }

const card: React.CSSProperties = { background: 'var(--surface-raised)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 16 }
const input: React.CSSProperties = { background: '#071525', color: 'var(--t1)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, padding: '9px 10px', fontSize: 13 }
const button: React.CSSProperties = { border: 0, borderRadius: 10, padding: '10px 14px', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }

export default function XeroIntegrationPage() {
  const [state, setState] = useState<State | null>(null)
  const [busy, setBusy] = useState('')
  const [maxPages, setMaxPages] = useState(5)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [mappings, setMappings] = useState<MappingData | null>(null)
  const [mappingError, setMappingError] = useState('')
  const [mappingForm, setMappingForm] = useState<Mapping>({ enabled: false, salesAccountCode: '', salesTaxType: '', purchaseAccountCode: '', purchaseTaxType: '', paymentAccountCode: '' })
  const [queue, setQueue] = useState<QueueData | null>(null)
  const [preview, setPreview] = useState<{ number: string; payload: unknown } | null>(null)

  const loadExtras = useCallback(async (connection: XeroConnection | null) => {
    if (connection?.status !== 'connected') { setMappings(null); setQueue(null); return }
    const [mappingRes, queueRes] = await Promise.all([
      fetch('/api/integrations/xero/mappings', { cache: 'no-store' }),
      fetch('/api/integrations/xero/writeback?take=30', { cache: 'no-store' }),
    ])
    const mappingBody = await mappingRes.json().catch(() => ({}))
    const queueBody = await queueRes.json().catch(() => ({}))
    if (mappingRes.ok) {
      setMappings(mappingBody)
      setMappingForm(mappingBody.mapping)
      setMappingError('')
    } else {
      setMappings(null)
      setMappingError(mappingBody.missingScopes?.length ? `Reconnect Xero to grant: ${mappingBody.missingScopes.join(', ')}` : mappingBody.error || 'Write-back mappings unavailable')
    }
    if (queueRes.ok) setQueue(queueBody)
    else setQueue(null)
  }, [])

  const load = useCallback(async () => {
    const res = await fetch('/api/integrations/xero', { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Failed to load Xero integration')
    setState(data)
    const configured = Number(data.connection?.settings?.maxPages || 5)
    setMaxPages(Number.isFinite(configured) ? Math.max(1, Math.min(10, Math.trunc(configured))) : 5)
    await loadExtras(data.connection || null)
  }, [loadExtras])

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

  async function connect() {
    const res = await fetch('/api/integrations/xero/connect', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Connect failed')
    window.location.assign(data.authorizeUrl)
  }

  async function loadMoreQueue() {
    const page = queue?.pagination
    if (!page?.hasMore) return
    setBusy('queue-more')
    setMessage(null)
    try {
      const params = new URLSearchParams({
        take: String(page.take || 30),
        clientSkip: String(page.clientSkip || 0),
        subSkip: String(page.subSkip || 0),
      })
      const res = await fetch('/api/integrations/xero/writeback?' + params.toString(), { cache: 'no-store' })
      const data = await res.json().catch(() => ({})) as QueueData & { error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to load more write-back candidates')
      setQueue(prev => {
        if (!prev) return data
        const merged = new Map(prev.items.map(item => [item.entityType + ':' + item.entityId, item]))
        for (const item of data.items || []) merged.set(item.entityType + ':' + item.entityId, item)
        return {
          ...data,
          items: [...merged.values()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        }
      })
    } catch (error) {
      setMessage({ kind: 'err', text: error instanceof Error ? error.message : 'Failed to load more write-back candidates' })
    } finally { setBusy('') }
  }

  async function writeback(item: QueueItem, dryRun: boolean) {
    setBusy(`${dryRun ? 'preview' : 'export'}:${item.entityType}:${item.entityId}`)
    setMessage(null)
    try {
      const res = await fetch('/api/integrations/xero/writeback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: item.entityType,
          entityId: item.entityId,
          dryRun,
          syncPayment: item.localStatus === 'paid',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Write-back failed')
      if (dryRun) setPreview({ number: item.number, payload: data.payload })
      else setMessage({ kind: 'ok', text: `${item.number} synced to Xero${data.payment ? ' with payment' : ''}.` })
      await load()
    } catch (error) {
      setMessage({ kind: 'err', text: error instanceof Error ? error.message : 'Write-back failed' })
    } finally { setBusy('') }
  }

  const connected = state?.connection?.status === 'connected'
  const missingWriteScopes = queue?.connection?.missingScopes || []

  return (
    <main style={{ background: 'var(--bg0)', minHeight: '100dvh', color: 'var(--t1)', padding: '20px 20px 100px 60px', fontFamily: 'var(--font-system)' }}>
      <Link href="/settings" style={{ color: 'var(--t2)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 14 }}><IcChevL size={18} color="var(--t2)" />Settings</Link>
      <h1 style={{ fontSize: 26, margin: '0 0 4px' }}>Xero accounting</h1>
      <p style={{ color: 'var(--t2)', maxWidth: 820, lineHeight: 1.55 }}>Import bank evidence for reconciliation and optionally export governed client invoices and subcontract bills. Write-back is disabled until a Company Admin maps valid Xero accounts and tax rates; Cortexx never invents VAT, CIS or payment-account treatment.</p>

      {message && <div role={message.kind === 'err' ? 'alert' : 'status'} style={{ margin: '14px 0', padding: '11px 14px', borderRadius: 10, background: message.kind === 'ok' ? 'rgba(16,185,129,.14)' : 'rgba(239,68,68,.14)', color: message.kind === 'ok' ? '#34d399' : '#f87171' }}>{message.text}</div>}

      {!state ? <p style={{ color: 'var(--t2)' }}>Loading…</p> : !state.platformConfigured ? (
        <section style={card}>
          <h2 style={{ marginTop: 0, fontSize: 17 }}>Platform setup required</h2>
          <p style={{ color: '#c5d4e7' }}>The Cortexx deployment needs a Xero OAuth app before companies can connect. Missing configuration: <strong>{state.missingPlatformConfig.join(', ')}</strong>.</p>
        </section>
      ) : (
        <div style={{ display: 'grid', gap: 14, maxWidth: 980 }}>
          <section style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Connection</div>
                <h2 style={{ margin: '5px 0 3px', fontSize: 18 }}>{state.connection?.tenantName || 'Not connected'}</h2>
                <div style={{ color: connected ? '#34d399' : '#f59e0b', fontSize: 13 }}>{state.connection?.status || 'disconnected'}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {!connected ? <button type="button" style={button} disabled={!!busy} onClick={() => void action('connect', connect)}>{busy === 'connect' ? 'Preparing…' : 'Connect Xero'}</button> : (
                  <>
                    {(mappingError || missingWriteScopes.length > 0) && <button type="button" style={{ ...button, background: '#7c3aed' }} disabled={!!busy} onClick={() => void action('reconnect', connect)}>Reconnect for write-back</button>}
                    <button type="button" style={{ ...button, background: '#7f1d1d' }} disabled={!!busy} onClick={() => {
                      if (window.confirm('Disconnect this company from Xero? Imported bank history and Cortexx reconciliation will be retained.')) void action('disconnect', async () => {
                        const res = await fetch('/api/integrations/xero', { method: 'DELETE' }); const data = await res.json()
                        if (!res.ok) throw new Error(data.error || 'Disconnect failed'); return data.warning ? `Disconnected locally. ${data.warning}` : 'Xero disconnected.'
                      })
                    }}>Disconnect</button>
                  </>
                )}
              </div>
            </div>
            {state.connection?.scopes?.length ? <p style={{ color: 'var(--t3)', fontSize: 11 }}>Granted: {state.connection.scopes.join(' · ')}</p> : null}
          </section>

          <section style={card}>
            <h2 style={{ marginTop: 0, fontSize: 17 }}>Bank import</h2>
            <p style={{ color: 'var(--t2)', fontSize: 13, lineHeight: 1.55 }}>Imports Xero bank transactions into the canonical Cortexx bank ledger. Existing allocations are retained and repeat imports are idempotent by Xero transaction ID.</p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ color: '#c5d4e7', fontSize: 13 }}>Max pages per run <input aria-label="Max Xero pages per run" type="number" min={1} max={10} value={maxPages} onChange={e => setMaxPages(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} style={{ ...input, width: 70, marginLeft: 6 }} /></label>
              <button type="button" style={{ ...button, background: '#1d4ed8' }} disabled={!!busy} onClick={() => void action('save', async () => {
                const res = await fetch('/api/integrations/xero', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ maxPages }) }); const data = await res.json()
                if (!res.ok) throw new Error(data.error || 'Save failed'); return 'Import limit saved.'
              })}>Save limit</button>
              <button type="button" style={button} disabled={!connected || !!busy} onClick={() => void action('sync', async () => {
                const res = await fetch('/api/integrations/xero/sync', { method: 'POST' }); const data = await res.json()
                if (!res.ok) throw new Error(data.retryAfter ? `${data.error}; retry in ${data.retryAfter}s` : data.error || 'Import failed')
                return `Bank import complete: ${data.created} new, ${data.updated} updated, ${data.unchanged} unchanged${data.bounded ? ' (page limit reached)' : ''}.`
              })}>{busy === 'sync' ? 'Importing…' : 'Import bank transactions'}</button>
            </div>
            <p style={{ color: 'var(--t2)', fontSize: 12 }}>Imported: {state.connection?.importedCount || 0} · Last import: {state.connection?.lastSyncAt ? new Date(state.connection.lastSyncAt).toLocaleString('en-GB') : 'never'}</p>
          </section>

          <section style={card}>
            <h2 style={{ marginTop: 0, fontSize: 17 }}>Governed write-back mappings</h2>
            <p style={{ color: 'var(--t2)', fontSize: 13, lineHeight: 1.55 }}>Mappings are loaded from the connected Xero organisation and validated again server-side when saved. Sales and purchase documents remain blocked when their required mapping or accounting breakdown is missing.</p>
            {mappingError ? <div role="alert" style={{ color: '#fbbf24', fontSize: 13 }}>{mappingError}</div> : mappings ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <MappingSelect label="Sales account" value={mappingForm.salesAccountCode} options={mappings.salesAccounts.map(x => ({ value: x.code, label: `${x.code} · ${x.name}` }))} onChange={value => setMappingForm(x => ({ ...x, salesAccountCode: value }))} />
                <MappingSelect label="Sales VAT/tax rate" value={mappingForm.salesTaxType} options={mappings.taxRates.map(x => ({ value: x.taxType, label: `${x.name}${x.rate == null ? '' : ` · ${x.rate}%`}` }))} onChange={value => setMappingForm(x => ({ ...x, salesTaxType: value }))} />
                <MappingSelect label="Purchase account" value={mappingForm.purchaseAccountCode} options={mappings.purchaseAccounts.map(x => ({ value: x.code, label: `${x.code} · ${x.name}` }))} onChange={value => setMappingForm(x => ({ ...x, purchaseAccountCode: value }))} />
                <MappingSelect label="Purchase VAT/tax rate" value={mappingForm.purchaseTaxType} options={mappings.taxRates.map(x => ({ value: x.taxType, label: `${x.name}${x.rate == null ? '' : ` · ${x.rate}%`}` }))} onChange={value => setMappingForm(x => ({ ...x, purchaseTaxType: value }))} />
                <MappingSelect label="Payment account" value={mappingForm.paymentAccountCode} options={mappings.paymentAccounts.map(x => ({ value: x.code, label: `${x.code} · ${x.name}` }))} onChange={value => setMappingForm(x => ({ ...x, paymentAccountCode: value }))} />
                <label style={{ color: 'var(--t2)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" checked={mappingForm.enabled} onChange={e => setMappingForm(x => ({ ...x, enabled: e.target.checked }))} />
                  Enable governed write-back
                </label>
                <button type="button" style={{ ...button, justifySelf: 'start' }} disabled={!!busy} onClick={() => void action('mapping', async () => {
                  const res = await fetch('/api/integrations/xero', {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      writebackEnabled: mappingForm.enabled,
                      salesAccountCode: mappingForm.salesAccountCode,
                      salesTaxType: mappingForm.salesTaxType,
                      purchaseAccountCode: mappingForm.purchaseAccountCode,
                      purchaseTaxType: mappingForm.purchaseTaxType,
                      paymentAccountCode: mappingForm.paymentAccountCode,
                    }),
                  })
                  const data = await res.json().catch(() => ({}))
                  if (!res.ok) throw new Error(data.error || 'Mapping save failed')
                  return 'Xero mappings saved and validated.'
                })}>Save mappings</button>
              </div>
            ) : <p style={{ color: 'var(--t3)', fontSize: 13 }}>Connect Xero to configure mappings.</p>}
          </section>

          <section style={card}>
            <h2 style={{ marginTop: 0, fontSize: 17 }}>Write-back queue</h2>
            <p style={{ color: 'var(--t2)', fontSize: 13 }}>Preview the exact accounting payload first. Export is idempotent; a successfully synced local record will not create another Xero invoice.</p>
            {!queue?.items?.length ? <p style={{ color: 'var(--t3)', fontSize: 13 }}>No invoices or subcontract bills to display.</p> : (
              <div style={{ display: 'grid', gap: 8 }}>
                {queue.items.map(item => {
                  const key = `${item.entityType}:${item.entityId}`
                  const invoiceSynced = item.writeback?.status === 'synced'
                  const paymentSynced = item.localStatus !== 'paid' || item.paymentWriteback?.status === 'synced'
                  const synced = invoiceSynced && paymentSynced && !item.changedSinceSync
                  const effectiveBlocker = item.blocker || item.paymentBlocker || null
                  return <div key={key} style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: 11, display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div><strong>{item.number}</strong> · {item.counterparty}<div style={{ color: 'var(--t3)', fontSize: 11 }}>{item.project || 'No project'} · £{Number(item.amount || 0).toLocaleString('en-GB')} · {item.localStatus}</div></div>
                      <div style={{ color: synced ? '#34d399' : effectiveBlocker ? '#fbbf24' : '#93c5fd', fontSize: 12 }}>{synced ? 'Synced' : effectiveBlocker || 'Ready'}</div>
                    </div>
                    {item.writeback?.lastError && <div style={{ color: '#f87171', fontSize: 11 }}>{item.writeback.lastError}</div>}
                    {item.paymentWriteback?.lastError && <div style={{ color: '#f87171', fontSize: 11 }}>Payment: {item.paymentWriteback.lastError}</div>}
                    {invoiceSynced && !paymentSynced && <div style={{ color: '#fbbf24', fontSize: 11 }}>Invoice is in Xero; payment still needs retry.</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" style={{ ...button, background: '#334155', padding: '7px 10px' }} disabled={!!busy || !!effectiveBlocker} onClick={() => void writeback(item, true)}>Preview</button>
                      <button type="button" style={{ ...button, padding: '7px 10px' }} disabled={!!busy || !!effectiveBlocker || synced || !queue.connection?.writebackEnabled} onClick={() => {
                        if (window.confirm(`Export ${item.number} to Xero? This creates an accounting document in the connected organisation.`)) void writeback(item, false)
                      }}>{synced ? 'Exported' : 'Export to Xero'}</button>
                    </div>
                  </div>
                })}
                {queue.pagination?.hasMore && (
                  <button type="button" style={{ ...button, background: '#334155', justifySelf: 'start' }} disabled={!!busy} onClick={() => void loadMoreQueue()}>
                    {busy === 'queue-more' ? 'Loading…' : 'Load more · ' + queue.items.length + ' of ' + queue.pagination.total}
                  </button>
                )}
                {queue.pagination && !queue.pagination.hasMore && queue.pagination.total > 0 && (
                  <div style={{ color: 'var(--t3)', fontSize: 11 }}>Showing all {queue.pagination.total} accounting documents.</div>
                )}
              </div>
            )}
          </section>

          {preview && <section style={card}>
            <h2 style={{ marginTop: 0, fontSize: 17 }}>Preview · {preview.number}</h2>
            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: '#cbd5e1', background: '#071525', padding: 12, borderRadius: 10, fontSize: 11 }}>{JSON.stringify(preview.payload, null, 2)}</pre>
            <button type="button" style={{ ...button, background: '#334155' }} onClick={() => setPreview(null)}>Close preview</button>
          </section>}


          <section style={card}>
            <h2 style={{ marginTop: 0, fontSize: 17 }}>Connection health</h2>
            <div style={{ color: 'var(--t2)', fontSize: 13 }}>Last health check: {state.connection?.lastHealthAt ? new Date(state.connection.lastHealthAt).toLocaleString('en-GB') : 'never'}</div>
            <button type="button" style={{ ...button, background: '#1d4ed8', marginTop: 10 }} disabled={!connected || !!busy} onClick={() => void action('test', async () => {
              const res = await fetch('/api/integrations/xero/test', { method: 'POST' }); const data = await res.json()
              if (!res.ok) throw new Error(data.error || 'Test failed'); return `Connected to ${data.organisation?.name || 'Xero'}.`
            })}>Test connection</button>
          </section>
        </div>
      )}
    </main>
  )
}

function MappingSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return <label style={{ color: 'var(--t2)', fontSize: 12, display: 'grid', gap: 5 }}>{label}
    <select aria-label={label} value={value} onChange={e => onChange(e.target.value)} style={input}>
      <option value="">Not mapped</option>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>
}
