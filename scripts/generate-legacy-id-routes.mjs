#!/usr/bin/env node
/**
 * Generate [id]/route.ts (GET single, PUT update, DELETE) for the 24
 * legacy-parity modules whose list/create-only routes were scaffolded
 * by generate-legacy-parity-modules.mjs. Without these, the modules
 * are list-only (no edit, no delete) and don't qualify as "complete".
 *
 * Reads the existing app/api/<slug>/route.ts to extract:
 *   - the prisma model accessor (e.g. prisma.payrollRun)
 *   - the field spread used in POST (re-used for PUT validation)
 *
 * Idempotent: overwrites generated [id] files.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = '/home/claude/app'

const MODULES = [
  'payroll', 'holiday', 'bank', 'carbon', 'waste', 'performance',
  'templates', 'forms', 'reminders', 'saved-views', 'tags', 'goals',
  'improve-hub', 'kaizen-board', 'process-library', 'reviews',
  'apprentice', 'claims', 'currency', 'personas', 'service-catalog',
  'sub-portal', 'developer-api', 'infrastructure',
]

function extractParts(src) {
  const accessor = (src.match(/prisma\.(\w+)\.findMany/) || [])[1]
  const fieldSpreadBlock = (src.match(/data:\s*\{([\s\S]*?)\},?\s*\}\)/) || [])[1] || ''
  return { accessor, fieldSpreadBlock: fieldSpreadBlock.trim() }
}

let written = 0
for (const slug of MODULES) {
  const listPath = join(ROOT, 'app/api', slug, 'route.ts')
  if (!existsSync(listPath)) { console.log(`skip: no list route for ${slug}`); continue }
  const src = readFileSync(listPath, 'utf8')
  const { accessor, fieldSpreadBlock } = extractParts(src)
  if (!accessor) { console.log(`skip: no prisma accessor in ${slug}`); continue }

  const idDir = join(ROOT, 'app/api', slug, '[id]')
  if (!existsSync(idDir)) mkdirSync(idDir, { recursive: true })
  const idPath = join(idDir, 'route.ts')

  const body = `import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  try {
    const item = await prisma.${accessor}.findUnique({ where: { id } })
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ item })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  const { id } = await params
  try {
    const body = await req.json().catch(() => ({}))
    const item = await prisma.${accessor}.update({
      where: { id },
      data: {
      ${fieldSpreadBlock}
      },
    })
    return NextResponse.json({ item })
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    console.error(error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  const { id } = await params
  try {
    await prisma.${accessor}.delete({ where: { id } })
    await auditLog({
      userId: (auth.user as { id?: string }).id,
      action: '${slug}.delete',
      resourceType: '${accessor}',
      resourceId: id,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
`
  writeFileSync(idPath, body)
  console.log(`✓ ${slug} → ${idPath}`)
  written++
}
console.log(`Wrote ${written} [id] route files`)
