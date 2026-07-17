#!/usr/bin/env node
/**
 * Codemod: add enforceRateLimit() to every POST/PUT/DELETE route.ts in
 * app/api that uses requireAuth and doesn't already have a limiter call.
 *
 * Idempotent — files that already import enforceRateLimit are skipped.
 *
 * Run: node scripts/add-rate-limits.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const SKIP_DIRS = ['cron', 'webhooks', 'client-view', 'seed', 'health', 'auth/']

const files = execSync(
  "find app/api -name route.ts -print",
  { encoding: 'utf8' },
).trim().split('\n').filter(Boolean)

let modified = 0
let skipped = 0

for (const path of files) {
  if (SKIP_DIRS.some(d => path.includes(`/api/${d}`))) { skipped++; continue }
  let src = readFileSync(path, 'utf8')

  if (src.includes('enforceRateLimit')) { skipped++; continue }
  if (!/export async function (POST|PUT|DELETE)\b/.test(src)) { skipped++; continue }
  if (!src.includes('requireAuth')) { skipped++; continue }

  // 1. Add import. Find the existing import block and append.
  const importMatch = src.match(/^import .* from '@\/lib\/requireAuth'/m)
  if (importMatch) {
    src = src.replace(importMatch[0], `${importMatch[0]}\nimport { enforceRateLimit } from '@/lib/rateLimit'`)
  } else {
    // Fall back: inject after the first import line
    src = src.replace(/^(import .+?\n)/m, `$1import { enforceRateLimit } from '@/lib/rateLimit'\n`)
  }

  // 2. Add the limiter right after `if (auth instanceof NextResponse) return auth`
  // inside POST/PUT/DELETE handlers. Match the requireAuth + guard pattern.
  // Pattern variants:
  //   const auth = await requireAuth()
  //   if (auth instanceof NextResponse) return auth
  // OR
  //   const session = await requireAuth()
  //   if (session instanceof NextResponse) return session
  //
  // Insert: const __limited = enforceRateLimit(req, 'write', (NAME.user as {id?: string}).id); if (__limited) return __limited
  src = src.replace(
    /(export async function (?:POST|PUT|DELETE)[^{]*\{\s*\n\s*const (\w+) = await requireAuth\(\)\s*\n\s*if \(\2 instanceof NextResponse\) return \2)/g,
    (match, capture, varName) => {
      return `${match}\n  const __limited = enforceRateLimit(req, 'write', (${varName}.user as { id?: string }).id)\n  if (__limited) return __limited`
    },
  )

  writeFileSync(path, src)
  modified++
}

console.log(`✓ Rate-limited ${modified} route file(s) (skipped ${skipped})`)
