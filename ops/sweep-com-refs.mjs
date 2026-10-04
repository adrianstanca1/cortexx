#!/usr/bin/env node
// Inventory every cortexbuildpro.com reference in the canonical repo, bucketed by
// whether it is live runtime code, a test, CI, or historical documentation.
// Retired domain per docs/CANONICAL_PRODUCT_AUDIT_2026-09-24.md + docs/reviews/2026-09-24-consolidation.md
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const NEEDLE = 'cortexbuildpro.com'
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.expo'])
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.sh', '.swift', '.plist', '.entitlements'])

const bucketOf = (rel) => {
  if (rel.startsWith('docs/reviews/') || rel.startsWith('docs/patches/')) return 'historical-doc'
  if (rel.startsWith('docs/')) return 'doc'
  if (rel.startsWith('test/') || rel.startsWith('tests/')) return 'test'
  if (rel.startsWith('.github/')) return 'ci'
  if (rel.startsWith('expo/') || rel.startsWith('ios/') || rel.startsWith('app-store/')) return 'mobile-shipped'
  if (rel.startsWith('app/') || rel.startsWith('lib/') || rel.startsWith('agents/')) return 'live-app'
  if (rel.startsWith('docker-compose') || rel.startsWith('Dockerfile') || rel === 'deploy.sh' || rel.startsWith('deploy/') || rel.startsWith('ops/')) return 'infra'
  if (rel.startsWith('scripts/')) return 'script'
  if (rel.startsWith('server/')) return 'legacy-server'
  if (rel.startsWith('test/')) return 'test'
  if (rel.includes('/') === false) return 'root'
  return 'other'
}

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const p = join(dir, name)
    let st
    try { st = statSync(p) } catch { return } // broken symlink (e.g. bin/libggml-base.so)
    if (st.isDirectory()) walk(p, out)
    else if (CODE_EXT.has(extname(name)) || extname(name) === '.md' || extname(name) === '.json' ||
             extname(name) === '.yml' || extname(name) === '.yaml' || extname(name) === '.txt' ||
             extname(name) === '.html' || name === 'Caddyfile' || name === '.env.example' ||
             name.startsWith('server.env')) out.push(p)
  }
  return out
}

const buckets = new Map()
let total = 0
for (const file of walk(ROOT)) {
  let text
  try { text = readFileSync(file, 'utf8') } catch { continue }
  if (!text.includes(NEEDLE)) continue
  const rel = relative(ROOT, file)
  const b = bucketOf(rel)
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    if (!line.includes(NEEDLE)) return
    total++
    if (!buckets.has(b)) buckets.set(b, [])
    buckets.get(b).push({ rel, line: i + 1, code: line.trim().slice(0, 150), isDoc: !CODE_EXT.has(extname(rel)) })
  })
}

const LIVE = ['live-app', 'mobile-shipped', 'infra', 'script', 'root', 'other']
const rank = (b) => (LIVE.includes(b) ? 0 : b === 'test' ? 1 : b === 'ci' ? 2 : 3)
const order = [...buckets.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))

for (const b of order) {
  const hits = buckets.get(b)
  const codeHits = hits.filter(h => h.isDoc).length
  console.log(`\n##### ${b} — ${hits.length} hits (${hits.length - codeHits} code / ${codeHits} prose)`)
  for (const h of hits) console.log(`  ${h.rel}:${h.line}  ${h.code}`)
}
console.log(`\nTOTAL ${total} hits across ${order.length} buckets`)
console.log(`RUNTIME-CRITICAL (live-app + mobile-shipped + infra + root): ${
  LIVE.filter(b => buckets.has(b)).reduce((n, b) => n + buckets.get(b).length, 0)}`)
