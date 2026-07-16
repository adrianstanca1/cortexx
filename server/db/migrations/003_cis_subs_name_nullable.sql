-- Fix: cis_subs.name was NOT NULL but the generic collection POST
-- (POST /api/:collection) only inserts (id, workspace_id, data); the full
-- record lives in the data JSONB. The NOT NULL on name caused every CIS
-- subcontractor create to 500. Relax it — name is a denormalized convenience
-- column and the source of truth is the data blob.
ALTER TABLE cis_subs ALTER COLUMN name DROP NOT NULL;
-- Also relax cis_payments.date for the same reason (future-proof the
-- generic insert path for CIS payment rows).
ALTER TABLE cis_payments ALTER COLUMN date DROP NOT NULL;
