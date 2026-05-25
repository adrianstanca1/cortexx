#!/usr/bin/env node
/**
 * Codemod: add a fire-and-forget auditLog() call to every DELETE handler
 * under app/api/ that does a real Prisma delete.
 *
 * Pattern injected — right after the await prisma.<model>.delete({ where:
 * { id: ... } }) line — fits the dominant route shape of:
 *
 *   await prisma.<model>.delete({ where: { id: params.id } })
 *   auditLog({
 *     action: '<model>.delete',
 *     resourceType: '<Model>',
 *     resourceId: params.id,
 *     ...requestMeta(req),
 *   })
 *
 * organizationId is filled in by auditLog from the AsyncLocalStorage org
 * context that requireAuth() sets. userId same.
 *
 * Idempotent — files that already have auditLog usage are skipped.
 *
 * Skips:
 *   • Routes that already call auditLog
 *   • Routes whose DELETE handler doesn't match the simple
 *     prisma.<model>.delete({ where: { id: ... } }) shape (manual fix)
 *   • Routes with a `_req` (unused) parameter — those need a manual rename
 *     to `req` first so requestMeta(req) works. Reported, not modified.
 *
 * Run: node scripts/add-audit-log-to-deletes.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const files = execSync(
  "grep -rlE '^export async function DELETE' app/api --include=route.ts",
  { encoding: 'utf8' },
).trim().split('\n').filter(Boolean)

const modified = []
const skipped = []
const manualReview = []

for (const path of files) {
  let src = readFileSync(path, 'utf8')

  if (src.includes('auditLog(')) {
    skipped.push({ path, reason: 'already audits' })
    continue
  }

  // Find the DELETE handler's prisma.<model>.delete({ where: { id: <expr> } }) line.
  // Most routes use `params.id` as the where target.
  const deleteMatch = src.match(
    /await prisma\.(\w+)\.delete\(\{\s*where:\s*\{\s*id:\s*([^}]+?)\s*\}\s*\}\)/,
  )
  if (!deleteMatch) {
    manualReview.push({ path, reason: 'no plain prisma.X.delete({ where: { id: ... } }) — bespoke shape' })
    continue
  }
  const [fullMatch, modelLower, idExpr] = deleteMatch
  const modelPascal = modelLower.charAt(0).toUpperCase() + modelLower.slice(1)

  // Pull DELETE handler signature so we know the request param name.
  const sigMatch = src.match(/export async function DELETE\(\s*(\w+)/)
  if (!sigMatch) {
    manualReview.push({ path, reason: 'no DELETE handler signature' })
    continue
  }
  let reqName = sigMatch[1]
  // If the handler ignores the request (`_req` convention for unused), rename
  // it to `req` so requestMeta(req) can pull headers. Safe because we ADD
  // the first usage in the same edit — the param wasn't referenced before.
  if (reqName.startsWith('_')) {
    src = src.replace(/export async function DELETE\(\s*_req\b/, 'export async function DELETE(req')
    reqName = 'req'
  }

  // Inject the audit + requestMeta imports.
  if (!src.includes("from '@/lib/audit'")) {
    const importLine = "import { auditLog, requestMeta } from '@/lib/audit'"
    // Insert after the last existing import from '@/lib/...' so the
    // import block stays grouped.
    const lastLibImportMatch = src.match(/(import .+? from '@\/lib\/[^']+'\n)(?![\s\S]*import .+? from '@\/lib\/)/)
    if (lastLibImportMatch) {
      src = src.replace(lastLibImportMatch[0], lastLibImportMatch[0] + importLine + '\n')
    } else {
      src = src.replace(/^(import .+\n)/m, `$1${importLine}\n`)
    }
  } else if (!/import \{[^}]*auditLog[^}]*\} from '@\/lib\/audit'/.test(src)) {
    // audit imported but auditLog itself missing — extend the existing import.
    src = src.replace(/import \{ ([^}]+) \} from '@\/lib\/audit'/, (_m, names) => {
      const want = new Set(names.split(',').map(s => s.trim()))
      want.add('auditLog')
      want.add('requestMeta')
      return `import { ${Array.from(want).join(', ')} } from '@/lib/audit'`
    })
  }

  // Append the auditLog call right after the prisma.X.delete line. Use
  // indented form matching the surrounding 2-space indent.
  const insertion = `${fullMatch}\n    auditLog({\n      action: '${modelLower}.delete',\n      resourceType: '${modelPascal}',\n      resourceId: ${idExpr.trim()},\n      ...requestMeta(${reqName}),\n    })`
  src = src.replace(fullMatch, insertion)

  writeFileSync(path, src)
  modified.push(path)
}

console.log(`✓ Added auditLog to ${modified.length} DELETE handler(s)`)
modified.forEach(p => console.log(`  · ${p}`))
console.log()
console.log(`↩ Skipped (already audited): ${skipped.length}`)
skipped.forEach(s => console.log(`  · ${s.path} — ${s.reason}`))
console.log()
console.log(`⚠ Manual review needed: ${manualReview.length}`)
manualReview.forEach(m => console.log(`  · ${m.path} — ${m.reason}`))
