# Xero accounting adapter

Cortexx connects each company to its own Xero organisation through OAuth 2.0. The first production slice is deliberately read-only: Xero bank transactions are imported into the canonical Cortexx bank-reconciliation ledger; Cortexx does not create or modify Xero invoices, bills, contacts or payments.

## Platform setup

Register a Xero OAuth app with this callback (replace the host for non-production environments):

`https://cortexbuildpro.tech/api/integrations/xero/callback`

Set these deployment secrets; never commit real values:

- `XERO_CLIENT_ID`
- `XERO_CLIENT_SECRET`
- `XERO_REDIRECT_URI`
- `XERO_TOKEN_ENCRYPTION_KEY` — generate with `openssl rand -hex 32`

The connector requests only identity/offline access plus granular read scopes for bank transactions and accounting settings. It does not request the deprecated broad transaction scope or any accounting write scope.

## Company setup

A Company Admin opens **Settings → Xero accounting**, connects the company Xero organisation, tests the connection, and chooses a bounded import page limit (1–10; default 5). OAuth access and rotating refresh tokens are AES-256-GCM encrypted at rest. The OAuth callback is bound to the signed-in user who initiated the connection and rechecks their admin membership before storing the grant.

## Bank import behaviour

- Xero `RECEIVE*` transactions import as positive amounts and `SPEND*` transactions as negative amounts.
- Xero `BankTransactionID` is the idempotency key. Re-running imports updates source evidence without duplicating rows.
- Existing Cortexx bank allocations, matched status and reconciliation decisions are never overwritten by a Xero refresh.
- After the first bounded import, subsequent runs use `If-Modified-Since` with a five-minute overlap for resilient incremental updates.
- Xero 429 responses surface `Retry-After` to the caller. A 401 triggers one refresh-token rotation/retry; failed refreshes mark the connection `reauth_required`.
- Imported bank history stays in Cortexx if Xero is disconnected.

## Deliberate write boundary

Outbound invoice/bill/payment sync is not enabled in this slice. A future write adapter will introduce its mapping records only when write scopes are enabled and account-code, tax/VAT, CIS and approval semantics are explicitly mapped and contract-tested.
