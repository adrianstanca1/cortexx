-- Migration 008: fold the ad-hoc boot-time ALTERs in server/index.js into a
-- real migration, now that a runner applies these on every boot.
--
-- These columns were being added by hand-written `ALTER TABLE … ADD COLUMN IF
-- NOT EXISTS` calls inside ensurePlatformAdmin() because the live
-- `cortexx_pgdata` volume predates them and schema.sql only runs on a fresh
-- volume. Keeping them there meant schema changes lived in two places —
-- migrations/ for some, JavaScript for others. They belong here.
--
-- All statements are idempotent, so this is a no-op on any database that
-- already went through the index.js path.

-- Platform-operator flag. Authority for /api/admin/* is gated on this column,
-- never on the tenant `role` (which defaults to 'director' for every
-- self-service signup). Present in schema.sql for fresh volumes; added here for
-- databases created before it existed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT false;

-- `notifications` shipped with created_at but no updated_at, while the generic
-- /api/:collection writer sets updated_at on every TEXT-id + JSONB table — so
-- every write to that collection failed with
-- `column "updated_at" of relation "notifications" does not exist`.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
