-- 0015_invoices_lineitems_jsonb
-- Convert invoices.lineItems from opaque text → structured jsonb so that
-- finance.createInvoice can re-derive cisDeductionAmount from the line
-- items and reject mismatches at the persistence boundary (Phase 3.3).
--
-- Defensive cast for legacy edge cases:
--   - NULL passes through unchanged
--   - empty / whitespace-only → '[]'::jsonb (treat as "no items")
--   - everything else → ::jsonb (Postgres' built-in parser)
--
-- Postgres has no TRY_CAST for jsonb. If a row contains malformed JSON
-- (not valid object/array syntax), the cast in the ELSE arm raises and
-- aborts the migration step. Note: .github/workflows/deploy.yml currently
-- warns-and-continues on `drizzle-kit migrate` failure — the bundle still
-- ships, but Phase 3.2 (which expects jsonb at the application layer)
-- would surface the column-type drift as a typecheck/test failure on the
-- next CI run, gating subsequent merges.
--
-- BEFORE MERGING: run the audit query in production to confirm 0
-- malformed rows. The query is in the PR body. The btrim() in the
-- empty-string arm here matches that audit query's tolerance for
-- whitespace-only legacy values.
ALTER TABLE invoices
  ALTER COLUMN "lineItems" TYPE jsonb
  USING CASE
    WHEN "lineItems" IS NULL THEN NULL
    WHEN btrim("lineItems") = '' THEN '[]'::jsonb
    ELSE "lineItems"::jsonb
  END;
