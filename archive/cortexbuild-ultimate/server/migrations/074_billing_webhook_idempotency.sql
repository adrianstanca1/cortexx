-- 074_billing_webhook_idempotency.sql
-- Fix: subscription_events idempotency was checking payload->>'id' but the
-- payload column stores event.data (the data envelope), not the full event.
-- Add a dedicated stripe_event_id column with a unique constraint so duplicate
-- webhook deliveries are reliably deduplicated.

ALTER TABLE subscription_events
  ADD COLUMN IF NOT EXISTS stripe_event_id VARCHAR(255);

-- Unique only when the value is set so existing rows (with NULL) don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS subscription_events_stripe_event_id_uidx
  ON subscription_events (stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

-- Index supports the new idempotency lookup pattern.
CREATE INDEX IF NOT EXISTS subscription_events_stripe_event_id_idx
  ON subscription_events (stripe_event_id);
