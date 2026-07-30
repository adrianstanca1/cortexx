-- Migration 007: make record ids workspace-scoped on the v1.3 typed tables.
--
-- WHY
-- These 13 tables shipped with `id TEXT PRIMARY KEY` — unique across the whole
-- table rather than per tenant. The SPA mints ids from local state
-- (`Math.max(0, ...ids) + 1` in lib/backend.js), so every workspace
-- independently creates id '1', '2', '3'. Combined with the generic
-- /api/:collection upsert (`ON CONFLICT (id) DO UPDATE`), the first workspace
-- to claim an id owned that row globally and every other workspace's write was
-- silently redirected into it: the writer lost its record and the owner's list
-- showed the writer's data. Sequential ids made this fire in normal use, not
-- just under attack.
--
-- WHAT
-- Replace the global `id` primary key with a UNIQUE (workspace_id, id)
-- constraint so each workspace gets its own id namespace, and point the
-- generic upsert's ON CONFLICT at it.
--
-- A UNIQUE constraint is used rather than PRIMARY KEY (workspace_id, id)
-- deliberately: a primary key requires workspace_id NOT NULL, and pre-existing
-- rows with a NULL workspace_id (orphans, invisible to every tenant because
-- reads filter on workspace_id) would have to be deleted first. This migration
-- destroys no rows.
--
-- Idempotent: re-running is a no-op once the constraint exists, so it is safe
-- to execute on every boot (server/index.js runs it before binding the socket).

-- cis_payments.sub_id references cis_subs(id), which requires cis_subs to keep
-- a unique constraint on `id` alone. Drop the FK first, then re-create it
-- against the workspace-scoped key so the reference stays inside one tenant.
ALTER TABLE cis_payments DROP CONSTRAINT IF EXISTS cis_payments_sub_id_fkey;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'receipts', 'cis_subs', 'cis_payments', 'timesheets', 'diary_entries',
    'snags', 'change_orders', 'rfis', 'subs', 'materials', 'documents_meta',
    'equipment', 'notifications'
  ] LOOP
    -- Skip tables that are not present (a DB provisioned before v1.3).
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;

    -- Add the workspace-scoped key first so the table is never left without a
    -- uniqueness guarantee on (workspace_id, id).
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = ('public.' || t)::regclass
        AND conname  = t || '_ws_id_key'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (workspace_id, id)',
        t, t || '_ws_id_key');
    END IF;

    -- Then drop the global primary key on `id` alone. Guarded on the key being
    -- exactly (id) so a DB already migrated to a composite PK is left alone.
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = ('public.' || t)::regclass
        AND c.contype  = 'p'
        AND c.conkey   = ARRAY[(
          SELECT a.attnum FROM pg_attribute a
          WHERE a.attrelid = ('public.' || t)::regclass AND a.attname = 'id'
        )]
    ) THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', t, t || '_pkey');
    END IF;
  END LOOP;
END $$;

-- Re-create the CIS payment → subcontractor reference, now workspace-scoped.
-- MATCH SIMPLE (the default) skips the check when sub_id IS NULL, so unlinked
-- payments stay valid.
DO $$
BEGIN
  IF to_regclass('public.cis_payments') IS NOT NULL
     AND to_regclass('public.cis_subs') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.cis_payments'::regclass
         AND conname  = 'cis_payments_sub_ws_fkey'
     ) THEN
    ALTER TABLE cis_payments
      ADD CONSTRAINT cis_payments_sub_ws_fkey
      FOREIGN KEY (workspace_id, sub_id)
      REFERENCES cis_subs(workspace_id, id) ON DELETE CASCADE;
  END IF;
END $$;
