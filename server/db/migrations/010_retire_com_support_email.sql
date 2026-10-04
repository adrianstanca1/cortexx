-- Retire cortexbuildpro.com: repoint the seeded support address at the
-- canonical cortexbuildpro.tech domain.
--
-- Migration 006 seeded platform_settings.general.support_email with
-- support@cortexbuildpro.com. That domain is retired and its DNS delegation
-- is broken at the registrar, so the address is undeliverable. It is served
-- by GET/PUT /admin/settings, i.e. operators can still read (and re-save) it.
--
-- This is a forward fix: 006 is left untouched as applied history. The
-- UPDATE is guarded on the exact legacy value so an operator who has already
-- corrected the address by hand is never overwritten.

UPDATE platform_settings
   SET value = jsonb_set(
         value,
         '{support_email}',
         '"support@cortexbuildpro.tech"'::jsonb,
         true
       ),
       updated_at = now()
 WHERE key = 'general'
   AND value ->> 'support_email' = 'support@cortexbuildpro.com';
