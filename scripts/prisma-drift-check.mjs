#!/usr/bin/env node
/**
 * prisma-drift-check.mjs
 *
 * Checks a limited set of cross-schema naming/reference heuristics:
 *   - server/db/schema.sql is the data schema for the legacy Express API.
 *   - prisma/schema.prisma and its migrations define the Next.js application's
 *     data model; that is the intended production stack. The two schemas are
 *     separate and this script only applies best-effort name/reference checks.
 *
 * This check catches two classes of drift that are safe to fail CI on:
 *   1. A raw-SQL table with no name-matching Prisma model (except allowlisted
 *      tables) -> a schema-name difference to review, not proof of a runtime bug.
 *   2. A Prisma model with no raw-SQL table AND no usage anywhere in the repo
 *      (app/ components/ server/ lib/) -> a likely unused model to review.
 *
 * It does NOT establish that these schemas describe the same database, nor that
 * a SQL table and Prisma model are semantically compatible. Names and counts are
 * printed as heuristic signals for review, not as a migration or readiness gate.
 *
 * Exit codes: 0 = aligned, 1 = drift detected.
 * No dependencies — pure Node (>=18) stdlib.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SCHEMA_SQL = join(ROOT, 'server', 'db', 'schema.sql');
const PRISMA = join(ROOT, 'prisma', 'schema.prisma');

// ── parse raw SQL table names ────────────────────────────────────────────────
function parseSqlTables(sql) {
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?([a-zA-Z_][a-zA-Z0-9_]*)[`"]?/gi;
  const out = new Set();
  let m;
  while ((m = re.exec(sql)) !== null) out.add(m[1].toLowerCase());
  return out;
}

// ── parse Prisma model names ─────────────────────────────────────────────────
function parsePrismaModels(text) {
  const re = /^model\s+([A-Za-z][A-Za-z0-9]*)/gm;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

// ── map a Prisma model name -> candidate raw SQL table name ───────────────────
// Prisma convention: PascalCase singular  ->  snake_case plural (best-effort).
function modelToTable(model) {
  // split PascalCase into words
  let words = model.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  // pluralise the final word if it isn't already plural
  if (!/(s|es|x|ies|ch|sh)$/.test(words)) words += 's';
  else if (/y$/.test(words)) words = words.replace(/y$/, 'ies');
  return words;
}

// ── collect every identifier referenced in source (for orphan detection) ───────
function walk(dir, acc) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === '.next') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (['.ts', '.tsx', '.jsx', '.js'].includes(extname(entry))) acc.push(full);
  }
}
function collectRepoIdentifiers() {
  const files = [];
  for (const d of ['app', 'components', 'lib', 'server', 'prisma']) {
    const p = join(ROOT, d);
    try { walk(p, files); } catch { /* dir may be absent */ }
  }
  const bag = new Set();
  for (const f of files) {
    let txt;
    try { txt = readFileSync(f, 'utf8'); } catch { continue; }
    // Include the database and transaction aliases used by typed helpers and
    // atomic route writes, e.g. db.supplierQualityEvidence / tx.user.
    const re = /(?:\b(?:prisma|db|tx)\.|model\s+)([A-Za-z][A-Za-z0-9]*)/g;
    let m;
    while ((m = re.exec(txt)) !== null) bag.add(m[1]);
  }
  return bag;
}

function main() {
  const sql = readFileSync(SCHEMA_SQL, 'utf8');
  const prismaText = readFileSync(PRISMA, 'utf8');
  const sqlTables = parseSqlTables(sql);
  const prismaModels = parsePrismaModels(prismaText);
  const used = collectRepoIdentifiers();

  // ── allowlists (keeps CI green + catches NET-NEW drift) ──────────────────
  // INTENTIONAL_NO_MODEL: raw-SQL tables explicitly excluded from the current
  // name-match heuristic. This legacy allowlist is not a production compatibility
  // contract and must be reviewed when either API/data model changes.
  const INTENTIONAL_NO_MODEL = new Set([
    'documents_store', 'documents_meta', 'ai_history', 'audit_log', 'photos',
    'portal_tokens', 'portal_messages', 'magic_links', 'site_maps', 'sync_log',
    'sync_record_versions', // Express sync internals; deliberately not part of the Next.js Prisma domain.
    'receipts', 'cis_subs', 'cis_payments', 'timesheets', 'diary_entries',
    'change_orders', 'subs', 'notifications', 'activity_log', 'bank_connections',
    'iap_entitlements', 'hmrc_submissions', 'api_connections',
  ]);
  // KNOWN_GAPS: raw-SQL tables excluded from the name-match heuristic pending
  // revalidation of the historical mapping in docs/DATA_MODEL_DRIFT.md.
  const KNOWN_GAPS = new Set(['workspaces']);
  // Prisma models intentionally unmapped (next-auth v5 convention names kept for
  // future Email-provider wiring; legacy; documented, not queried yet).
  const ALLOWED_ORPHANS = new Set(['Account', 'Session', 'VerificationToken']);

  const problems = [];

  // 1. SQL table without any Prisma model that maps to it
  for (const t of sqlTables) {
    if (INTENTIONAL_NO_MODEL.has(t) || KNOWN_GAPS.has(t)) continue;
    const hasModel = prismaModels.some((m) => modelToTable(m) === t || m.toLowerCase() === t.replace(/s$/, ''));
    if (!hasModel) problems.push(`SQL table '${t}' has NO matching Prisma model`);
  }

  // 2. Prisma model with no SQL table AND no repo usage (true orphan)
  const sqlTableNames = new Set([...sqlTables]);
  for (const m of prismaModels) {
    if (ALLOWED_ORPHANS.has(m)) continue;
    const table = modelToTable(m);
    const backed = sqlTableNames.has(table) || sqlTableNames.has(m.toLowerCase());
    const referenced = used.has(m) || used.has(m.charAt(0).toLowerCase() + m.slice(1));
    if (!backed && !referenced) {
      problems.push(`Prisma model '${m}' is an ORPHAN (no SQL table, never referenced in app/components/lib/server)`);
    }
  }

  console.error(`# raw SQL tables : ${sqlTables.size}`);
  console.error(`# prisma models  : ${prismaModels.length}`);
  console.error(`# repo identifiers scanned: ${used.size}`);

  if (problems.length) {
    console.error('\n❌ DATA-MODEL DRIFT DETECTED:');
    for (const p of problems) console.error('  - ' + p);
    console.error('\nReview schema ownership and mappings before changing either schema or its allowlists.');
    process.exit(1);
  }
  console.error('\n✅ SQL/Prisma drift heuristics passed (no unallowlisted missing-table or orphan findings).');
  process.exit(0);
}

main();
