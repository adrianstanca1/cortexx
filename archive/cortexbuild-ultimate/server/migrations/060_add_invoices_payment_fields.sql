-- Migration: 060_add_invoices_payment_fields
-- Adds missing columns referenced in ALLOWED_COLUMNS.invoices but absent from DB schema.
-- These columns are used by the invoicing frontend UI (payment_terms, bank_account, notes).

BEGIN;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_terms text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bank_account text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes text;

COMMIT;
