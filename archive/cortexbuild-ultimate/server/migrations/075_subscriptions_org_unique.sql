-- 075_subscriptions_org_unique.sql
-- Add the unique constraint on organization_id that the billing route already
-- assumes via `ON CONFLICT (organization_id)`. Without this, the first
-- checkout attempt for any org throws Postgres error 42P10
-- ("there is no unique or exclusion constraint matching the ON CONFLICT
-- specification").
--
-- Safe to add even with existing data because migration 071 was deployed
-- only minutes before this one and has no rows yet in production.

-- Drop and recreate as unique only if no duplicates exist; otherwise the
-- migration fails loudly so an operator can pick a single subscription per
-- org before continuing. (We do not silently choose one for them.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscriptions_organization_id_key'
      AND conrelid = 'subscriptions'::regclass
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_organization_id_key UNIQUE (organization_id);
  END IF;
END $$;
