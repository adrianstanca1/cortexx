#!/usr/bin/env node
/**
 * One-shot generator for the 24 parity-with-legacy modules.
 *
 * Reads /tmp/modules.txt (slug|title|category|tagline|model|fields)
 * and emits:
 *   • prisma schema fragments → stdout, paste into prisma/schema.prisma
 *   • app/<slug>/page.tsx files (per-module page using ModuleShell)
 *   • app/api/<slug>/route.ts files (GET list + POST create)
 *   • app/apps/page.tsx update — adds module entries to the grid
 *
 * Idempotent — re-running overwrites generated files.
 *
 * Field spec syntax: name:Type where Type ∈ String|Int|Float|Bool|Date
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'

const ROOT = '/home/claude/app'
const SPEC = '/tmp/modules.txt'

const TYPE_MAP = {
  String: { prisma: 'String?',   ts: 'string' },
  Int:    { prisma: 'Int?',      ts: 'number' },
  Float:  { prisma: 'Float?',    ts: 'number' },
  Bool:   { prisma: 'Boolean?',  ts: 'boolean' },
  Date:   { prisma: 'DateTime?', ts: 'string' },
}

const modules = readFileSync(SPEC, 'utf8')
  .split('\n')
  .filter(l => l && !l.startsWith('#'))
  .map(line => {
    const [slug, title, category, tagline, model, fieldSpec] = line.split('|')
    const fields = fieldSpec.split(',').map(f => {
      const [name, type] = f.split(':')
      return { name: name.trim(), type: type.trim() }
    })
    return { slug, title, category, tagline, model, fields }
  })

console.log(`# Generated for ${modules.length} modules`)

// ─── 1. Prisma schema fragments ─────────────────────────────────────
const schemaBlocks = []
for (const m of modules) {
  const fieldLines = m.fields.map(f => {
    const t = TYPE_MAP[f.type] || { prisma: 'String?' }
    return `  ${f.name.padEnd(18)} ${t.prisma}`
  }).join('\n')
  schemaBlocks.push(
    `model ${m.model} {
  id             String   @id @default(cuid())
  organizationId String?
  organization   Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)
${fieldLines}
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([organizationId])
}`,
  )
}

writeFileSync('/tmp/schema-additions.prisma', schemaBlocks.join('\n\n') + '\n')
console.log(`✓ schema fragments → /tmp/schema-additions.prisma (${schemaBlocks.length} models)`)

// ─── 2. Page files (one per module) ──────────────────────────────────
const fieldUiSnippet = (m) => {
  // Render the first 3 string-shaped fields as a one-line "summary" in the list.
  const summary = m.fields.slice(0, 3).map(f => `r.${f.name}`).join(' + " · " + ')
  return summary || `r.id`
}

for (const m of modules) {
  const pageDir = join(ROOT, 'app', m.slug)
  mkdirSync(pageDir, { recursive: true })
  const pageContent = `'use client'

import { useEffect, useState } from 'react'
import ModuleShell from '@/components/ui/ModuleShell'

interface Row { id: string; createdAt: string; [k: string]: unknown }

export default function ${m.model}Page() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/${m.slug}')
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error || 'Failed') }))
      .then(d => setRows(d.items || []))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false))
  }, [])

  const create = async () => {
    const title = window.prompt('New ${m.title.toLowerCase()} — short label')
    if (!title) return
    const res = await fetch('/api/${m.slug}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ${m.fields[0].name}: title }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      window.alert(d.error || 'Failed to create')
      return
    }
    const created = await res.json()
    setRows(prev => [created.item, ...prev])
  }

  return (
    <ModuleShell
      title=${JSON.stringify(m.title)}
      tagline=${JSON.stringify(m.tagline)}
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
            <li key={r.id} style={{ background: '#152641', borderRadius: 10, padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.07)', fontFamily: 'var(--font-system)', fontSize: 13, color: '#eef3fa' }}>
              <div>{[${m.fields.slice(0, 3).map(f => `r.${f.name}`).join(', ')}].filter(Boolean).join(' · ') || r.id}</div>
              <div style={{ fontSize: 11, color: '#52749a', marginTop: 4 }}>
                {new Date(r.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </ModuleShell>
  )
}
`
  writeFileSync(join(pageDir, 'page.tsx'), pageContent)
}
console.log(`✓ ${modules.length} page files written under app/<slug>/page.tsx`)

// ─── 3. API routes (one per module) ──────────────────────────────────
for (const m of modules) {
  const apiDir = join(ROOT, 'app', 'api', m.slug)
  mkdirSync(apiDir, { recursive: true })
  // Build the validated POST data object using the field spec.
  const postValidations = m.fields.map(f => {
    const t = TYPE_MAP[f.type] || TYPE_MAP.String
    if (f.type === 'Date') {
      return `      ...(typeof body.${f.name} === 'string' && body.${f.name} ? { ${f.name}: new Date(body.${f.name}) } : {}),`
    }
    if (f.type === 'Int' || f.type === 'Float') {
      return `      ...(typeof body.${f.name} === 'number' ? { ${f.name}: body.${f.name} } : {}),`
    }
    if (f.type === 'Bool') {
      return `      ...(typeof body.${f.name} === 'boolean' ? { ${f.name}: body.${f.name} } : {}),`
    }
    return `      ...(typeof body.${f.name} === 'string' ? { ${f.name}: body.${f.name}.trim() } : {}),`
  }).join('\n')

  const camelModel = m.model.charAt(0).toLowerCase() + m.model.slice(1)
  const apiContent = `import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 200

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const sp = req.nextUrl.searchParams
    const take = Math.min(parseInt(sp.get('take') || '50') || 50, MAX_TAKE)
    const skip = Math.max(0, parseInt(sp.get('skip') || '0') || 0)
    const items = await prisma.${camelModel}.findMany({
      orderBy: { createdAt: 'desc' },
      take, skip,
    })
    const total = await prisma.${camelModel}.count()
    return NextResponse.json({ items, total, hasMore: skip + items.length < total })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json().catch(() => ({}))
    const item = await prisma.${camelModel}.create({
      data: {
${postValidations}
      },
    })
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}
`
  writeFileSync(join(apiDir, 'route.ts'), apiContent)
}
console.log(`✓ ${modules.length} API routes written under app/api/<slug>/route.ts`)

// ─── 4. /apps grid entries ──────────────────────────────────────────
const appsEntries = modules.map(m =>
  `      { href: '/${m.slug}', label: ${JSON.stringify(m.title)}, Icon: IcLayers, color: '#8ea8c5', category: ${JSON.stringify(m.category)} },`,
).join('\n')
writeFileSync('/tmp/apps-additions.txt', appsEntries + '\n')
console.log(`✓ /apps additions → /tmp/apps-additions.txt (paste into existing categories)`)
console.log('')
console.log(`Done. Now:`)
console.log(`  1. Append /tmp/schema-additions.prisma to prisma/schema.prisma`)
console.log(`  2. Add back-refs in Organization model for each new collection`)
console.log(`  3. npx prisma format && npx prisma migrate dev (or write SQL by hand)`)
console.log(`  4. Update /apps page with /tmp/apps-additions.txt entries`)
console.log(`  5. npm test && npm run build && commit`)
