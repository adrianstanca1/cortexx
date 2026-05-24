/**
 * Shared helpers for tests that mock `getDb()` and assert on the
 * shape and bindings of the predicate passed to `.where()`.
 *
 * `collectColumns` and `collectBindings` walk the drizzle SQL tree
 * produced by `eq(...)`, `and(...)`, etc. The tree shape these
 * helpers traverse was verified against drizzle 0.45 via runtime
 * probe; see PR #152 / #153 history for details.
 */
import { getTableName } from "drizzle-orm";

/**
 * Read the drizzle-internal table name out of a Table object,
 * via Drizzle's public API.
 */
export function tableName(table: any): string {
  return getTableName(table);
}

/**
 * Walk a drizzle SQL predicate tree (the value passed to `.where()`)
 * and collect referenced column names.
 *
 * A drizzle Column is identifiable by carrying both `.name: string`
 * and a truthy `.table` reference. `eq(col, val)` returns an `SQL`
 * whose `.queryChunks` are `[StringChunk, Column, StringChunk, Param,
 * StringChunk]`; `and(a, b)` nests further `SQL` objects in its own
 * chunks, hence the recursion.
 */
export function collectColumns(
  node: any,
  out: Set<string> = new Set<string>(),
): Set<string> {
  if (node === null || node === undefined) return out;
  if (Array.isArray(node)) {
    for (const item of node) collectColumns(item, out);
    return out;
  }
  if (typeof node !== "object") return out;
  if (typeof node.name === "string" && node.table !== undefined) {
    out.add(node.name);
  }
  if (Array.isArray(node.queryChunks)) {
    for (const chunk of node.queryChunks) collectColumns(chunk, out);
  }
  return out;
}

/**
 * Walk a drizzle SQL predicate tree and collect column → bound-value
 * pairs (the values supplied to `eq()` / equivalents).
 *
 * Within a single `SQL.queryChunks` array, `eq(col, val)` lays out
 * `[StringChunk, Column, StringChunk, Param, StringChunk]`, so a
 * Column followed by a Param in the same chunk array is a binding.
 * `Param` is identifiable structurally — it carries both `.value`
 * and `.encoder`, neither of which Column or StringChunk has.
 *
 * Nested SQL boundaries (e.g. `and(eq(...), eq(...))`) reset the
 * column→param pairing so we never pair across SQL fragments.
 */
export function collectBindings(
  node: any,
  out: Record<string, unknown> = {},
): Record<string, unknown> {
  if (node === null || node === undefined) return out;
  if (Array.isArray(node)) {
    for (const item of node) collectBindings(item, out);
    return out;
  }
  if (typeof node !== "object") return out;
  if (Array.isArray(node.queryChunks)) {
    let lastCol: string | null = null;
    for (const chunk of node.queryChunks) {
      if (chunk === null || typeof chunk !== "object") continue;
      const isColumn =
        typeof chunk.name === "string" && chunk.table !== undefined;
      const isParam = !isColumn && "value" in chunk && "encoder" in chunk;
      if (isColumn) {
        lastCol = chunk.name;
      } else if (isParam && lastCol !== null) {
        out[lastCol] = chunk.value;
        lastCol = null;
      } else if (Array.isArray(chunk.queryChunks)) {
        lastCol = null;
        collectBindings(chunk, out);
      }
    }
  }
  return out;
}
