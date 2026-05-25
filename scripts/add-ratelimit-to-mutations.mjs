#!/usr/bin/env node
/**
 * Add enforceRateLimit('write', userId) to PUT/DELETE/POST handlers
 * that don't have it. Targets the 8 files the pre-launch feature audit
 * flagged (finding #6) where token-bearer abuse was unbounded.
 *
 * Strategy: insert the rate-limit pair right after the
 * `if (auth instanceof NextResponse) return auth` line. Idempotent:
 * skips handlers that already call enforceRateLimit.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const FILES = [
  'app/api/projects/[id]/route.ts',
  'app/api/projects/[id]/archive/route.ts',
  'app/api/tasks/[id]/route.ts',
  'app/api/snags/[id]/route.ts',
  'app/api/rfis/[id]/route.ts',
  'app/api/invoices/[id]/route.ts',
  'app/api/team/[id]/route.ts',
  'app/api/drawings/[id]/revisions/route.ts',
]

function patch(path) {
  let src = readFileSync(path, 'utf8')
  if (src.includes('enforceRateLimit')) {
    // Already has the import — but specific handlers might still be missing the call.
    // Continue and per-handler-insert as needed.
  } else {
    // Add the import after the requireAuth import line
    src = src.replace(
      /import\s+\{\s*requireAuth[^}]*\}\s+from\s+'@\/lib\/requireAuth'\n/,
      m => m + "import { enforceRateLimit } from '@/lib/rateLimit'\n",
    )
  }

  // For each PUT/DELETE/POST handler, insert the rate-limit pair after
  // the `if (auth instanceof NextResponse) return auth` line, IF that
  // handler doesn't already have an enforceRateLimit call.
  src = src.replace(
    /(export\s+async\s+function\s+(PUT|DELETE|POST)\s*\([^)]*\)\s*\{[\s\S]*?const\s+auth\s*=\s*await\s+requireAuth\(\)[\s\S]*?if\s*\(auth\s+instanceof\s+NextResponse\)\s+return\s+auth)([\s\S]*?)(?=^export\s+async\s+function|\Z)/gm,
    (match, prefix, _method, rest) => {
      if (/enforceRateLimit/.test(rest)) return match
      const insert = `\n  const limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)\n  if (limited) return limited`
      return prefix + insert + rest
    },
  )
  writeFileSync(path, src)
}

for (const f of FILES) {
  try {
    patch(f)
    console.log(`✓ ${f}`)
  } catch (e) {
    console.log(`✗ ${f}: ${e.message}`)
  }
}
