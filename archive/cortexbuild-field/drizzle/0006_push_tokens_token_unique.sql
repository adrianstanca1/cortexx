-- 0006_push_tokens_token_unique
-- Add a UNIQUE constraint on push_tokens.token so the procedure
-- pushTokens.register can use INSERT…ON CONFLICT DO UPDATE for an
-- atomic per-token upsert. Without the constraint, the previous
-- delete-then-insert pattern had a race window where two concurrent
-- registrations could both leave a row, defeating the deduplication.
--
-- Pre-step: dedupe before the constraint can be applied. We keep the
-- highest-id row for each token (most recent registration) — older
-- rows belonged to either previous account-holders on the same device
-- or idempotent re-registrations of the same user.

DELETE FROM push_tokens
USING (
  SELECT token, MAX(id) AS keep_id
  FROM push_tokens
  GROUP BY token
) keepers
WHERE push_tokens.token = keepers.token
  AND push_tokens.id <> keepers.keep_id;

-- Idempotent guard so re-running the migration on an environment that
-- already applied it doesn't fail.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'push_tokens_token_unique'
  ) THEN
    ALTER TABLE push_tokens
      ADD CONSTRAINT push_tokens_token_unique UNIQUE (token);
  END IF;
END
$$;
