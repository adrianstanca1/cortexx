#!/usr/bin/env node
// Replace the retired cortexbuildpro.com with the canonical cortexbuildpro.tech.
//
// Three classes of reference are DELIBERATELY NOT rewritten, because a literal
// .com -> .tech substitution would be wrong or destructive:
//
//  1. Migration seeds (server/db/migrations/*.sql). These rows are already
//     applied in production; rewriting a historical migration changes its
//     checksum and breaks drift detection / re-runs.
//  2. The domain-retirement guard test (test/canonical-domain-mobile-auth.test.js)
//     which asserts the string 'https://cortexbuildpro.com' is ABSENT from
//     runtime files. Rewriting the needle would invert the assertion.
//  3. The audit/retirement record itself (docs/reviews/, docs/patches/) plus any
//     line that documents the retirement, where .com must remain to stay accurate.
//
// Emails (@cortexbuildpro.com) ARE rewritten: the domain is retired, so those
// addresses no longer receive mail. The canonical contact domain on this product
// is cortexbuild.app (see .well-known/security.txt, app-store/metadata.txt).
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const OLD = 'cortexbuildpro.com'
const NEW = 'cortexbuildpro.tech'

// Paths (repo-relative, glob-free prefixes) that must keep the retired domain.
const KEEP_VERBATIM = [
  'server/db/migrations/',                    // applied-migration seeds
  'test/canonical-domain-mobile-auth.test.js', // the guard test's own needle
  'docs/reviews/',                            // historical retirement record
  'docs/patches/',                            // superseded nginx-era workflows
]
const isProtected = rel => KEEP_VERBATIM.some(p => rel.startsWith(p))

const r = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
const files = r.split('\n').filter(Boolean)

const changed = []
let hits = 0
let skipped = 0
for (const rel of files) {
  let text
  try { text = readFileSync(join(ROOT, rel), 'utf8') } catch { continue }
  if (!text.includes(OLD)) continue
  if (isProtected(rel)) { skipped += (text.match(new RegExp(OLD.replace('.', '\\.'), 'g')) || []).length; continue }
  const count = (text.match(new RegExp(OLD.replace('.', '\\.'), 'g')) || []).length
  writeFileSync(join(ROOT, rel), text.split(OLD).join(NEW))
  changed.push({ rel, count })
  hits += count
}

console.log(`rewrote ${hits} reference(s) across ${changed.length} file(s)`)
for (const c of changed) console.log(`  ${c.rel}  (${c.count})`)
console.log(`\nprotected (left as cortexbuildpro.com): ${skipped} reference(s)`)
for (const p of KEEP_VERBATIM) console.log(`  ${p}`)
