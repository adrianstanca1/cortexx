#!/usr/bin/env node
/**
 * Augment the 24 legacy-parity module pages with row delete actions.
 *
 * Each page was scaffolded list-only; adding delete makes records
 * manageable (the matching DELETE handlers landed earlier in the same
 * commit set). Approach: extract slug-specific parameters from each
 * existing page, re-emit from an updated template.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = '/home/claude/app'
const MODULES = [
  'payroll', 'holiday', 'bank', 'carbon', 'waste', 'performance',
  'templates', 'forms', 'reminders', 'saved-views', 'tags', 'goals',
  'improve-hub', 'kaizen-board', 'process-library', 'reviews',
  'apprentice', 'claims', 'currency', 'personas', 'service-catalog',
  'sub-portal', 'developer-api', 'infrastructure',
]

function extract(src, slug) {
  const componentName = (src.match(/export default function (\w+)/) || [])[1] || `Page_${slug}`
  const title = (src.match(/title="([^"]+)"/) || [])[1] || slug
  const tagline = (src.match(/tagline="([^"]+)"/) || [])[1] || ''
  // First field used for create body
  const firstField = (src.match(/JSON\.stringify\(\{\s*(\w+):/) || [])[1] || 'name'
  // Summary fields rendered in the row
  const summary = (src.match(/\[(r\.\w+(?:,\s*r\.\w+)*)\]\.filter/) || [])[1]
    || `r.${firstField}`
  return { componentName, title, tagline, firstField, summary }
}

function render({ slug, componentName, title, tagline, firstField, summary }) {
  return `'use client'

import { useEffect, useState } from 'react'
import ModuleShell from '@/components/ui/ModuleShell'

interface Row { id: string; createdAt: string; [k: string]: unknown }

export default function ${componentName}() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/${slug}')
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error || 'Failed') }))
      .then(d => setRows(d.items || []))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false))
  }, [])

  const create = async () => {
    const value = window.prompt('New ${title.toLowerCase()} — short label')
    if (!value) return
    const res = await fetch('/api/${slug}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ${firstField}: value }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      window.alert(d.error || 'Failed to create')
      return
    }
    const created = await res.json()
    setRows(prev => [created.item, ...prev])
  }

  const del = async (id: string) => {
    if (!window.confirm('Delete this record? This cannot be undone.')) return
    const res = await fetch(\`/api/${slug}/\${id}\`, { method: 'DELETE' })
    if (!res.ok) { window.alert('Delete failed'); return }
    setRows(prev => prev.filter(r => r.id !== id))
  }

  return (
    <ModuleShell
      title="${title}"
      tagline="${tagline}"
      action={{ label: 'New', onClick: create }}
    >
      {loading ? (
        <div style={{ color: '#52749a', fontSize: 13, fontFamily: 'var(--font-system)' }}>Loading…</div>
      ) : error ? (
        <div style={{ color: '#ef4444', fontSize: 13, fontFamily: 'var(--font-system)' }}>{error}</div>
      ) : rows.length === 0 ? (
        <div style={{ color: '#52749a', fontSize: 13, fontFamily: 'var(--font-system)', padding: 32, textAlign: 'center' }}>
          No records yet. Click <strong style={{ color: '#f59e0b' }}>New</strong> to add the first one.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(r => (
            <li key={r.id} style={{ background: '#152641', borderRadius: 10, padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.07)', fontFamily: 'var(--font-system)', fontSize: 13, color: '#eef3fa', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>{[${summary}].filter(Boolean).join(' · ') || r.id}</div>
                <div style={{ fontSize: 11, color: '#52749a', marginTop: 4 }}>
                  {new Date(r.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <button onClick={() => del(r.id)} style={{ flexShrink: 0, fontSize: 11, color: '#ef4444', background: 'transparent', border: '0.5px solid rgba(239,68,68,0.4)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font-system)' }}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </ModuleShell>
  )
}
`
}

let written = 0
for (const slug of MODULES) {
  const p = join(ROOT, 'app', slug, 'page.tsx')
  let src
  try { src = readFileSync(p, 'utf8') } catch { console.log(`skip: no page for ${slug}`); continue }
  const params = extract(src, slug)
  const out = render({ slug, ...params })
  writeFileSync(p, out)
  console.log(`✓ ${slug}: ${params.title} (${params.componentName})`)
  written++
}
console.log(`Wrote ${written} pages`)
