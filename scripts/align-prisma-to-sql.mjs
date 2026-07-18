#!/usr/bin/env node
/**
 * align-prisma-to-sql.mjs
 *
 * The Express + raw-SQL schema (server/db/schema.sql) is the CANONICAL
 * production data model for CortexBuild Pro (cortexbuildpro.com serves it via
 * /api/:collection). Prisma's schema.prisma is a parallel, drifted model used
 * only by the Next.js admin stack.
 *
 * This script reads the raw SQL schema, parses every CREATE TABLE name, and
 * emits a Prisma model skeleton (one `model` per real table) to stdout. Pipe it
 * into a file to bootstrap a Prisma schema that is aligned to the 34 tables the
 * backend actually persists:
 *
 *   node scripts/align-prisma-to-sql.mjs                 # print skeleton + report
 *   node scripts/align-prisma-to-sql.mjs --names         # print just the 34 table names
 *   node scripts/align-prisma-to-sql.mjs > prisma/schema.aligned.prisma
 *
 * No dependencies — pure Node (>=18) stdlib.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(__dirname, '..', 'server', 'db', 'schema.sql');

/** snake_case (usually plural) SQL table name -> PascalCase singular Prisma model. */
function toModelName(tableName) {
  const singular = singularize(tableName);
  return singular
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

function singularize(name) {
  // Only singularize the final word segment.
  const parts = name.split('_');
  let last = parts[parts.length - 1];
  if (/ies$/.test(last)) last = last.replace(/ies$/, 'y');
  else if (/(ses|xes|zes|ches|shes)$/.test(last)) last = last.replace(/es$/, '');
  else if (/s$/.test(last) && !/ss$/.test(last)) last = last.replace(/s$/, '');
  parts[parts.length - 1] = last;
  return parts.join('_');
}

function parseTableNames(sql) {
  // Matches: CREATE TABLE foo (   and   CREATE TABLE IF NOT EXISTS foo (
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([a-zA-Z_][a-zA-Z0-9_]*)["`]?/gi;
  const names = [];
  let m;
  while ((m = re.exec(sql)) !== null) names.push(m[1]);
  return names;
}

function main() {
  const sql = readFileSync(SCHEMA_PATH, 'utf8');
  const tables = parseTableNames(sql);
  const args = process.argv.slice(2);

  if (args.includes('--names')) {
    tables.forEach((t) => console.log(t));
    console.error(`\n# ${tables.length} tables parsed from ${SCHEMA_PATH}`);
    return;
  }

  const lines = [];
  lines.push('// AUTO-GENERATED from server/db/schema.sql — DO NOT hand-edit.');
  lines.push('// Regenerate: node scripts/align-prisma-to-sql.mjs > prisma/schema.aligned.prisma');
  lines.push('// The raw SQL schema is CANONICAL; these skeletons mirror the 34 real tables.');
  lines.push('');
  lines.push('generator client {');
  lines.push('  provider = "prisma-client-js"');
  lines.push('}');
  lines.push('');
  lines.push('datasource db {');
  lines.push('  provider = "postgresql"');
  lines.push('  url      = env("DATABASE_URL")');
  lines.push('}');
  lines.push('');

  for (const table of tables) {
    const model = toModelName(table);
    lines.push(`model ${model} {`);
    lines.push('  id        String   @id @default(cuid())');
    lines.push('  // TODO: mirror real columns from server/db/schema.sql');
    lines.push(`  @@map("${table}")`);
    lines.push('}');
    lines.push('');
  }

  process.stdout.write(lines.join('\n'));

  console.error('');
  console.error(`# ${tables.length} CREATE TABLE statements parsed from server/db/schema.sql`);
  console.error(`# ${tables.length} Prisma model skeletons emitted (each @@map'd to its real table).`);
}

main();
