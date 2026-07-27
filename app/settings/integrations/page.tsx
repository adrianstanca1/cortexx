'use client'

// Cortexx — Admin "Integrations" dashboard (central API registry UI).
//
// Operator surface for /api/admin/connections (server/routes/api-connections.js):
//   GET  /api/admin/connections            → { connections: [...], emailProvider? }
//   PUT  /api/admin/connections/:name      → rotate secret / update config / switch email provider
//   POST /api/admin/connections/:name/test → { ok, status, latencyMs?, error?/detail? }
//
// Auth: platform-admin JWT (Bearer). Same token the operator console (admin.js)
// stores in localStorage under 'admin_token' (falls back to the SPA's
// 'cortexx_token'). Secrets are NEVER shown raw — the API returns a masked
// preview only, and this page only ever renders that mask.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { IcChevL } from '@/components/ui/Icons'

// ── Types ────────────────────────────────────────────────────────────────────

interface Connection {
  name: string
  label: string
  category: string
  provider: string
  status: string
  hasSecret: boolean
  secretMask: string | null
  config: Record<string, unknown>
  lastTestedAt: string | null
  lastError: string | null
  updatedBy: string | null
  updatedAt: string | null
}

interface TestResult {
  ok: boolean
  status: string
  latencyMs: number | null
  detail: string | null
}

type EmailProvider = 'resend' | 'sendgrid'

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_ORDER = ['payments', 'banking', 'government', 'tax', 'push', 'ai', 'llm', 'email', 'agents', 'devops', 'other']
const CATEGORY_LABELS: Record<string, string> = {
  payments: 'Payments',
  banking: 'Open Banking',
  government: 'Government / HMRC',
  tax: 'Government / HMRC',
  push: 'Web Push',
  ai: 'AI / Inference',
  llm: 'LLM Providers',
  email: 'Email',
  agents: 'Agents',
  devops: 'DevOps',
  other: 'Other',
}

// Manual keys an operator can paste via "Add connection".
const MANUAL_KEYS: { name: string; label: string; category: string; provider: string }[] = [
  { name: 'github_pat', label: 'GitHub personal access token', category: 'devops', provider: 'github' },
  { name: 'expo_token', label: 'Expo access token', category: 'devops', provider: 'expo' },
  { name: 'openai_api_key', label: 'OpenAI API key', category: 'llm', provider: 'openai' },
  { name: 'gemini_api_key', label: 'Google Gemini API key', category: 'llm', provider: 'gemini' },
  { name: 'nvidia_api_key', label: 'NVIDIA API key', category: 'llm', provider: 'nvidia' },
  { name: 'claude_api_key', label: 'Anthropic Claude API key', category: 'llm', provider: 'anthropic' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function getOperatorToken(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem('admin_token') || window.localStorage.getItem('cortexx_token') || ''
  } catch {
    return ''
  }
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

// The server may return snake_case (secret-store.js list()) or camelCase —
// normalise both shapes into one Connection.
function normaliseConnection(raw: Record<string, unknown>): Connection {
  const config = raw.config && typeof raw.config === 'object' ? (raw.config as Record<string, unknown>) : {}
  const name = asString(raw.name) || 'unknown'
  return {
    name,
    label: asString(raw.label) || name,
    category: asString(raw.category) || 'other',
    provider: asString(raw.provider) || 'unknown',
    status: asString(raw.status) || 'unknown',
    hasSecret: raw.hasSecret === true,
    secretMask: asString(raw.secretMask) || asString(raw.secretPreview),
    config,
    lastTestedAt: asString(raw.lastTestedAt) || asString(raw.last_tested_at),
    lastError: asString(raw.lastError) || asString(raw.last_error),
    updatedBy: asString(raw.updatedBy) || asString(raw.updated_by),
    updatedAt: asString(raw.updatedAt) || asString(raw.updated_at),
  }
}

function maskedSecret(c: Connection): string {
  if (!c.hasSecret) return 'not set'
  if (c.secretMask) return c.secretMask
  return '••••••••'
}

function fmtTime(iso: string | null): string {
  if (!iso) return 'never'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'never'
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function statusColors(status: string, hasSecret: boolean): { bg: string; fg: string; label: string } {
  const s = status.toLowerCase()
  if (s === 'active' || s === 'configured' || s === 'ok') return { bg: 'rgba(16,185,129,0.15)', fg: '#10b981', label: 'configured' }
  if (s === 'error') return { bg: 'rgba(239,68,68,0.15)', fg: '#ef4444', label: 'error' }
  if (s === 'inactive') return { bg: 'rgba(255,255,255,0.06)', fg: '#8ea8c5', label: hasSecret ? 'inactive' : 'not configured' }
  return { bg: 'rgba(245,158,11,0.15)', fg: '#f59e0b', label: s || 'unknown' }
}

async function apiRequest(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const token = getOperatorToken()
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  })
  let data: Record<string, unknown> = {}
  try {
    const parsed: unknown = await res.json()
    if (parsed && typeof parsed === 'object') data = parsed as Record<string, unknown>
  } catch {
    // non-JSON body — keep {}
  }
  return { ok: res.ok, status: res.status, data }
}

function errorFromResponse(status: number, data: Record<string, unknown>): string {
  const err = asString(data.error)
  const hint = asString(data.hint)
  if (status === 401) return 'Unauthorized — sign in to the operator console (admin token missing or expired).'
  if (status === 403) return 'Forbidden — your account is not a platform admin.'
  if (err && hint) return `${err}: ${hint}`
  return err || `Request failed (${status})`
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [emailProvider, setEmailProvider] = useState<EmailProvider | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // Edit / rotate modal
  const [editing, setEditing] = useState<Connection | null>(null)
  // Add-connection modal
  const [adding, setAdding] = useState(false)

  // Inline test results, keyed by connection name
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})
  const [testing, setTesting] = useState<Record<string, boolean>>({})
  const [emailSwitching, setEmailSwitching] = useState(false)

  const showBanner = useCallback((kind: 'ok' | 'err', text: string) => {
    setBanner({ kind, text })
    window.setTimeout(() => setBanner(b => (b && b.text === text ? null : b)), 5000)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const { ok, status, data } = await apiRequest('/api/admin/connections')
      if (!ok) throw new Error(errorFromResponse(status, data))
      const rawList = Array.isArray(data.connections) ? (data.connections as unknown[]) : []
      setConnections(rawList
        .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
        .map(normaliseConnection))
      const ep = asString(data.emailProvider)
      setEmailProvider(ep === 'sendgrid' ? 'sendgrid' : ep === 'resend' ? 'resend' : null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load connections')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // Merge a saved/normalised connection into local state (optimistic-friendly).
  const upsertConnection = useCallback((conn: Connection) => {
    setConnections(prev => {
      const idx = prev.findIndex(c => c.name === conn.name)
      if (idx === -1) return [...prev, conn]
      const next = [...prev]
      next[idx] = conn
      return next
    })
  }, [])

  const runTest = useCallback(async (name: string) => {
    setTesting(prev => ({ ...prev, [name]: true }))
    try {
      const { ok, status, data } = await apiRequest(`/api/admin/connections/${encodeURIComponent(name)}/test`, { method: 'POST' })
      if (!ok) throw new Error(errorFromResponse(status, data))
      const result: TestResult = {
        ok: data.ok === true,
        status: asString(data.status) || (data.ok === true ? 'active' : 'error'),
        latencyMs: typeof data.latencyMs === 'number' ? data.latencyMs : null,
        detail: asString(data.detail) || asString(data.error),
      }
      setTestResults(prev => ({ ...prev, [name]: result }))
      // Reflect the tested status on the row itself.
      setConnections(prev => prev.map(c => c.name === name
        ? { ...c, status: result.status, lastTestedAt: new Date().toISOString(), lastError: result.ok ? null : result.detail }
        : c))
    } catch (e) {
      const detail = e instanceof Error ? e.message : 'Test failed'
      setTestResults(prev => ({ ...prev, [name]: { ok: false, status: 'error', latencyMs: null, detail } }))
    } finally {
      setTesting(prev => ({ ...prev, [name]: false }))
    }
  }, [])

  const switchEmailProvider = useCallback(async (target: EmailProvider) => {
    if (emailSwitching || target === emailProvider) return
    const previous = emailProvider
    setEmailSwitching(true)
    setEmailProvider(target) // optimistic
    try {
      const keyName = target === 'resend' ? 'resend_key' : 'sendgrid_key'
      const { ok, status, data } = await apiRequest(`/api/admin/connections/${encodeURIComponent(keyName)}`, {
        method: 'PUT',
        body: JSON.stringify({ emailProvider: target }),
      })
      if (!ok) throw new Error(errorFromResponse(status, data))
      showBanner('ok', asString(data.message) || `Active email provider switched to ${target}.`)
    } catch (e) {
      setEmailProvider(previous) // revert optimistic switch
      showBanner('err', e instanceof Error ? e.message : 'Failed to switch email provider')
    } finally {
      setEmailSwitching(false)
    }
  }, [emailProvider, emailSwitching, showBanner])

  const grouped = useMemo(() => {
    const byCat = new Map<string, Connection[]>()
    for (const c of connections) {
      const cat = CATEGORY_LABELS[c.category] ? c.category : 'other'
      const arr = byCat.get(cat) || []
      arr.push(c)
      byCat.set(cat, arr)
    }
    const orderedCats = [...byCat.keys()].sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a); const ib = CATEGORY_ORDER.indexOf(b)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
    return orderedCats.map(cat => ({ category: cat, items: byCat.get(cat) || [] }))
  }, [connections])

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', padding: '20px 20px 100px 60px' }}>
      {/* Back to settings hub */}
      <Link href="/settings" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 12 }}>
        <IcChevL size={18} color="#52749a" />
        <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>Settings</span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)', marginBottom: 4 }}>
            Integrations
          </h1>
          <p style={{ fontSize: 13, color: '#8ea8c5', fontFamily: 'var(--font-system)', marginBottom: 16, lineHeight: 1.5, maxWidth: 560 }}>
            Central API registry — every external connection the platform uses. Secrets are encrypted at rest
            and only ever shown masked. Rotations take effect immediately, no restart needed.
          </p>
        </div>
        <button type="button" onClick={() => setAdding(true)} style={{ ...primaryBtn, width: 'auto', padding: '10px 16px' }}>
          + Add connection
        </button>
      </div>

      {banner && (
        <div role="status" style={{
          marginBottom: 14, borderRadius: 10, padding: '10px 14px', fontFamily: 'var(--font-system)', fontSize: 13,
          background: banner.kind === 'ok' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${banner.kind === 'ok' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: banner.kind === 'ok' ? '#10b981' : '#ef4444',
        }}>
          {banner.text}
        </div>
      )}

      {/* Email provider banner */}
      <section style={{ ...sectionStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={labelStyle}>Active email provider</div>
          <div style={{ fontFamily: 'var(--font-system)', fontSize: 15, color: '#eef3fa', fontWeight: 700, marginTop: 6, textTransform: 'capitalize' }}>
            {emailProvider || 'unknown'}
          </div>
          <div style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#8ea8c5', marginTop: 2 }}>
            Transactional email (invites, magic links, digests) is sent through this provider.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['resend', 'sendgrid'] as const).map(p => (
            <button
              key={p}
              type="button"
              disabled={emailSwitching || emailProvider === p}
              onClick={() => void switchEmailProvider(p)}
              style={{
                padding: '8px 16px', borderRadius: 10, fontFamily: 'var(--font-system)', fontSize: 13, fontWeight: 600,
                cursor: emailSwitching || emailProvider === p ? 'default' : 'pointer',
                background: emailProvider === p ? '#2563eb' : '#1a2f4e',
                border: emailProvider === p ? '1px solid #2563eb' : '1px solid rgba(255,255,255,0.1)',
                color: emailProvider === p ? '#fff' : '#8ea8c5',
                opacity: emailSwitching ? 0.6 : 1,
                textTransform: 'capitalize',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </section>

      {/* States: loading / error / empty / list */}
      {loading ? (
        <div style={{ color: '#52749a', fontSize: 13, fontFamily: 'var(--font-system)', padding: '24px 0' }}>Loading connections…</div>
      ) : loadError ? (
        <div role="alert" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 10, padding: '12px 14px', fontFamily: 'var(--font-system)', fontSize: 13 }}>
          {loadError}
          <button type="button" onClick={() => void load()} style={{ ...secondaryBtn, width: 'auto', padding: '6px 14px', marginLeft: 12, fontSize: 12 }}>
            Retry
          </button>
        </div>
      ) : connections.length === 0 ? (
        <div style={{ color: '#52749a', fontSize: 13, fontFamily: 'var(--font-system)', padding: '24px 0' }}>
          No connections registered yet. Use “Add connection” to paste your first API key.
        </div>
      ) : (
        grouped.map(group => (
          <section key={group.category} style={{ marginTop: 18 }}>
            <div style={{ ...labelStyle, marginBottom: 8 }}>{CATEGORY_LABELS[group.category] || group.category}</div>
            <div style={{ background: '#152641', borderRadius: 14, border: '0.5px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              {group.items.map((c, i) => {
                const badge = statusColors(c.status, c.hasSecret)
                const test = testResults[c.name]
                return (
                  <div key={c.name} style={{ padding: '12px 14px', borderTop: i === 0 ? 'none' : '0.5px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#eef3fa', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {c.hasSecret && (
                            <span title="Secret configured (encrypted at rest)" aria-label="Secret configured" style={{ fontSize: 11 }}>🔒</span>
                          )}
                          {c.label}
                        </div>
                        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#52749a', marginTop: 2 }}>
                          {c.name} · {c.provider} · {maskedSecret(c)}
                        </div>
                      </div>

                      <span style={{ background: badge.bg, color: badge.fg, fontFamily: 'var(--font-system)', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                        {badge.label}
                      </span>

                      <div style={{ fontFamily: 'var(--font-system)', fontSize: 10, color: '#52749a', whiteSpace: 'nowrap' }}>
                        tested {fmtTime(c.lastTestedAt)}
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" onClick={() => setEditing(c)} style={{ ...secondaryBtn, width: 'auto', padding: '6px 12px', fontSize: 12 }}>
                          Edit / Rotate
                        </button>
                        <button
                          type="button"
                          disabled={!!testing[c.name]}
                          onClick={() => void runTest(c.name)}
                          style={{ ...secondaryBtn, width: 'auto', padding: '6px 12px', fontSize: 12, opacity: testing[c.name] ? 0.5 : 1 }}
                        >
                          {testing[c.name] ? 'Testing…' : 'Test'}
                        </button>
                      </div>
                    </div>

                    {c.lastError && (
                      <div style={{ marginTop: 6, fontFamily: 'var(--font-system)', fontSize: 11, color: '#ef4444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.lastError}>
                        ⚠ {c.lastError.length > 140 ? `${c.lastError.slice(0, 140)}…` : c.lastError}
                      </div>
                    )}

                    {test && (
                      <div role="status" style={{
                        marginTop: 8, borderRadius: 8, padding: '6px 10px', fontFamily: 'var(--font-system)', fontSize: 11,
                        background: test.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        border: `1px solid ${test.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                        color: test.ok ? '#10b981' : '#ef4444',
                      }}>
                        {test.ok ? '✓' : '✕'} {test.status}
                        {test.latencyMs != null && ` · ${test.latencyMs}ms`}
                        {test.detail && ` · ${test.detail}`}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))
      )}

      {editing && (
        <ConnectionModal
          title={`Edit — ${editing.label}`}
          initialName={editing.name}
          initialProvider={editing.provider}
          initialCategory={editing.category}
          initialConfig={editing.config}
          nameLocked
          currentMask={maskedSecret(editing)}
          onClose={() => setEditing(null)}
          onSaved={(conn, message) => {
            upsertConnection(conn)
            setEditing(null)
            showBanner('ok', message)
          }}
          onError={msg => showBanner('err', msg)}
        />
      )}

      {adding && (
        <ConnectionModal
          title="Add connection"
          initialName={MANUAL_KEYS[0].name}
          initialProvider={MANUAL_KEYS[0].provider}
          initialCategory={MANUAL_KEYS[0].category}
          initialConfig={{}}
          nameLocked={false}
          currentMask={null}
          onClose={() => setAdding(false)}
          onSaved={(conn, message) => {
            upsertConnection(conn)
            setAdding(false)
            showBanner('ok', message)
          }}
          onError={msg => showBanner('err', msg)}
        />
      )}
    </div>
  )
}

// ── Edit / Add modal ─────────────────────────────────────────────────────────

interface ConnectionModalProps {
  title: string
  initialName: string
  initialProvider: string
  initialCategory: string
  initialConfig: Record<string, unknown>
  nameLocked: boolean
  currentMask: string | null
  onClose: () => void
  onSaved: (conn: Connection, message: string) => void
  onError: (message: string) => void
}

function ConnectionModal({ title, initialName, initialProvider, initialCategory, initialConfig, nameLocked, currentMask, onClose, onSaved, onError }: ConnectionModalProps) {
  const [name, setName] = useState(initialName)
  const [provider, setProvider] = useState(initialProvider)
  const [category, setCategory] = useState(initialCategory)
  const [secret, setSecret] = useState('')
  const [configText, setConfigText] = useState(() => {
    const keys = Object.keys(initialConfig)
    return keys.length ? JSON.stringify(initialConfig, null, 2) : ''
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const pickManualKey = (keyName: string) => {
    const def = MANUAL_KEYS.find(k => k.name === keyName)
    setName(keyName)
    if (def) { setProvider(def.provider); setCategory(def.category) }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    let config: Record<string, unknown> | undefined
    if (configText.trim()) {
      try {
        const parsed: unknown = JSON.parse(configText)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Config must be a JSON object')
        config = parsed as Record<string, unknown>
      } catch (err) {
        setFormError(err instanceof Error ? `Invalid config JSON: ${err.message}` : 'Invalid config JSON')
        return
      }
    }

    if (!secret.trim() && !config) {
      setFormError('Provide a secret and/or config to save.')
      return
    }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {}
      if (secret.trim()) { body.secret = secret.trim(); body.rotate = true }
      if (config) body.config = config
      if (provider.trim()) body.provider = provider.trim()
      if (category.trim()) body.category = category.trim()

      const { ok, status, data } = await apiRequest(`/api/admin/connections/${encodeURIComponent(name)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      if (!ok) throw new Error(errorFromResponse(status, data))

      const rawConn = data.connection && typeof data.connection === 'object'
        ? (data.connection as Record<string, unknown>)
        : { name, provider, category, hasSecret: !!secret.trim(), status: 'active' }
      onSaved(normaliseConnection(rawConn), asString(data.message) || 'Connection saved.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      setFormError(msg)
      onError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ position: 'fixed', inset: 0, background: 'rgba(2,8,18,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <form onSubmit={save} style={{ background: '#0d1c33', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 460, maxHeight: '85dvh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-system)', fontSize: 16, fontWeight: 700, color: '#eef3fa', margin: 0 }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: '#52749a', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        {nameLocked ? (
          <div>
            <div style={labelStyle}>Connection</div>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: '#eef3fa', marginTop: 6 }}>{name}</div>
            {currentMask && (
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#52749a', marginTop: 2 }}>
                current secret: {currentMask}
              </div>
            )}
          </div>
        ) : (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>Key</span>
            <select value={name} onChange={e => pickManualKey(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
              {MANUAL_KEYS.map(k => (
                <option key={k.name} value={k.name}>{k.label} ({k.name})</option>
              ))}
            </select>
          </label>
        )}

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Secret {nameLocked ? '(leave blank to keep current)' : ''}</span>
          <input
            type="password"
            autoComplete="off"
            placeholder={nameLocked ? 'Paste new secret to rotate…' : 'Paste API key…'}
            value={secret}
            onChange={e => setSecret(e.target.value)}
            style={{ ...inputStyle, fontFamily: 'ui-monospace, monospace' }}
          />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>Provider</span>
            <input type="text" value={provider} onChange={e => setProvider(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>Category</span>
            <input type="text" value={category} onChange={e => setCategory(e.target.value)} style={inputStyle} />
          </label>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Config (JSON, optional)</span>
          <textarea
            rows={4}
            placeholder='{ "region": "eu-west-2" }'
            value={configText}
            onChange={e => setConfigText(e.target.value)}
            style={{ ...inputStyle, fontFamily: 'ui-monospace, monospace', fontSize: 12, resize: 'vertical' }}
          />
        </label>

        {formError && (
          <div role="alert" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 10, padding: '8px 12px', fontFamily: 'var(--font-system)', fontSize: 12 }}>
            {formError}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{ ...secondaryBtn, flex: 1 }}>Cancel</button>
          <button type="submit" disabled={saving} style={{ ...primaryBtn, flex: 1, opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Shared styles (match app/settings/* siblings) ────────────────────────────

const sectionStyle: React.CSSProperties = {
  background: '#152641',
  borderRadius: 14,
  padding: 16,
  marginBottom: 16,
  border: '0.5px solid rgba(255,255,255,0.07)',
}
const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-system)',
  fontSize: 11,
  color: '#52749a',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}
const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#1a2f4e',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '10px 12px',
  color: '#eef3fa',
  fontFamily: 'var(--font-system)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}
const primaryBtn: React.CSSProperties = {
  width: '100%',
  padding: '10px 0',
  borderRadius: 10,
  background: '#2563eb',
  border: 'none',
  color: '#fff',
  fontFamily: 'var(--font-system)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}
const secondaryBtn: React.CSSProperties = {
  ...primaryBtn,
  background: '#1a2f4e',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#eef3fa',
}
