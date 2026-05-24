/**
 * Pin the relationship between drizzle migration SQL files and the
 * `_journal.json` that drives `migrate()` at deploy + integration-test
 * time.
 *
 * Why this exists: 0008/0009/0010 SQL files were once committed without
 * journal entries, so drizzle-kit silently skipped them. Unit tests
 * mock `getDb` so they didn't notice; integration tests caught it via
 * runtime "column does not exist" failures, but only after schema-
 * dependent tests started failing. This guard catches the omission at
 * unit-test time before it reaches integration.
 *
 * The check: every Postgres-flavoured migration in drizzle/ must be
 * named in `_journal.json`, and every journal entry must point at a
 * file that exists. The legacy MySQL files (0000, 0002, 0003 — and
 * 0001_far_gravity which is a duplicate idx-0001 from a parallel
 * lineage) are exempt, mirroring the explicit comment in
 * tests/integration/setup.ts.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DRIZZLE_DIR = path.resolve(__dirname, "../drizzle");
const JOURNAL_PATH = path.resolve(DRIZZLE_DIR, "meta/_journal.json");

// Migration files left in drizzle/ for historical reasons but NOT applied
// by the Postgres journal. setup.ts keeps these out of `migrate()` because
// they contain MySQL syntax (backticks, AUTO_INCREMENT) that would crash
// on Postgres. If you need to add to this list, justify it in the spec.
const LEGACY_PG_EXEMPT = new Set<string>([
  "0000_elite_eternals.sql",
  "0001_far_gravity.sql",
  "0002_fair_human_robot.sql",
  "0003_cortexfield_v2.sql",
]);

type JournalEntry = { idx: number; tag: string; when: number };

function readJournal(): JournalEntry[] {
  const raw = JSON.parse(readFileSync(JOURNAL_PATH, "utf8"));
  if (raw.dialect !== "postgresql") {
    throw new Error(`_journal.json dialect must be "postgresql", got ${raw.dialect}`);
  }
  return raw.entries as JournalEntry[];
}

function listSqlFiles(): string[] {
  return readdirSync(DRIZZLE_DIR)
    .filter(f => f.endsWith(".sql"))
    .sort();
}

describe("drizzle migration journal completeness", () => {
  it("every Postgres SQL file in drizzle/ is registered in _journal.json", () => {
    const entries = readJournal();
    const tags = new Set(entries.map(e => e.tag));
    const sqlFiles = listSqlFiles();

    for (const f of sqlFiles) {
      if (LEGACY_PG_EXEMPT.has(f)) continue;
      const tag = f.replace(/\.sql$/, "");
      expect(
        tags.has(tag),
        `${f} exists in drizzle/ but is missing from _journal.json. ` +
        `Add a {idx, version: "7", when, tag, breakpoints} entry — drizzle's ` +
        `migrate() reads only the journal, so unregistered SQL files silently skip.`,
      ).toBe(true);
    }
  });

  it("every entry in _journal.json points at a SQL file that exists", () => {
    const entries = readJournal();
    const sqlFiles = new Set(listSqlFiles());

    for (const e of entries) {
      expect(
        sqlFiles.has(`${e.tag}.sql`),
        `_journal.json names "${e.tag}" but ${e.tag}.sql is missing from drizzle/. ` +
        `Either restore the SQL file or remove the journal entry.`,
      ).toBe(true);
    }
  });

  it("idx values are contiguous starting at 0 — gaps mean a migration was dropped mid-sequence", () => {
    const entries = readJournal();
    const idxs = entries.map(e => e.idx).sort((a, b) => a - b);
    for (let i = 0; i < idxs.length; i++) {
      expect(
        idxs[i],
        `idx values must be 0, 1, 2, … but found a gap at position ${i}: ${idxs.join(",")}`,
      ).toBe(i);
    }
  });

  it("when timestamps are monotonically increasing — out-of-order entries break apply order", () => {
    const entries = [...readJournal()].sort((a, b) => a.idx - b.idx);
    for (let i = 1; i < entries.length; i++) {
      expect(
        entries[i].when,
        `entry idx=${entries[i].idx} (${entries[i].tag}) has when=${entries[i].when} which is ` +
        `<= the previous entry's when=${entries[i - 1].when}. ` +
        `drizzle applies in journal order, but timestamps drifting backwards is a sign the ` +
        `journal was hand-edited inconsistently.`,
      ).toBeGreaterThan(entries[i - 1].when);
    }
  });
});
