import { expect } from "vitest";

/**
 * Assert that a recorded WHERE clause contains the given column names
 * AND binds them to the supplied input values.
 *
 * Combines the two patterns that every tenant-safety test uses:
 *
 *   expect(record.whereCols).toEqual(expect.arrayContaining([...keys]));
 *   expect(record.whereBindings).toMatchObject(expected);
 *
 * Caller passes a record produced by the drizzle-mock chains
 * (`dbCalls.selectFroms[i]`, `dbCalls.updates[i]`, `dbCalls.deletes[i]`)
 * and a `{ col: expectedValue }` map. Both assertions run; on failure
 * the diff identifies which side regressed (column reference vs. bound
 * value).
 *
 * `toMatchObject` is permissive about extra properties — that's
 * deliberate. `whereBindings` may legitimately carry additional
 * predicates beyond the tenancy keys (e.g. an optional projectId
 * filter); the helper asserts the tenancy keys are pinned without
 * forbidding others. Tests that need to assert *absence* of a
 * predicate keep the inline `not.toContain` / `not.toHaveProperty`
 * assertion alongside the helper call.
 */
export function expectTenantWhere(
  record: { whereCols: string[]; whereBindings: Record<string, unknown> },
  expected: Record<string, unknown>,
): void {
  const expectedCols = Object.keys(expected);
  expect(record.whereCols).toEqual(expect.arrayContaining(expectedCols));
  expect(record.whereBindings).toMatchObject(expected);
}
