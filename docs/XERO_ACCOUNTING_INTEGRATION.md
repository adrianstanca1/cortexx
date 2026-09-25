# Xero accounting integration

Cortexx keeps its project cost, valuation, bank and procurement ledgers canonical. The Xero adapter transfers accounting records without bypassing those ledgers.

## Platform setup

Create a Xero OAuth 2.0 web app and register the exact callback URL:

`https://cortexbuildpro.tech/api/integrations/xero/callback`

Set these deployment secrets (never commit real values):

- `XERO_CLIENT_ID`
- `XERO_CLIENT_SECRET`
- `XERO_REDIRECT_URI`
- `XERO_TOKEN_ENCRYPTION_KEY` — generate with `openssl rand -hex 32`

The connector requests granular scopes for invoices, payments, contacts and accounting settings plus `offline_access`; it does not request the deprecated broad transaction scope.

## Company setup

A Company Admin opens **Settings → Xero accounting**, connects the company Xero organisation, then enters the Xero sales/purchase account codes and tax types. Subcontract bill sync is opt-in.

## Sync behaviour

- Sales invoices are created/updated as Xero `ACCREC` drafts.
- Subcontract invoices are optional Xero `ACCPAY` drafts; Cortexx CIS retention is called out for accounting review rather than silently changing the Xero bill total.
- Sync is bounded to 25 records per action and uses persistent local↔remote links to avoid duplicate creates.
- Pull sync only moves local lifecycle status forward when Xero becomes authorised/paid; it does not overwrite Cortexx amounts.
- Refresh tokens are encrypted at rest with AES-256-GCM and rotated on refresh.
- Disconnect targets only the stored Xero connection ID for that company, then clears local OAuth secrets while retaining sync history.
- Configuration, connect/disconnect and sync actions are tenant-scoped and audited.

## Operational state

If platform Xero credentials are absent, the UI fails safely with **Platform setup required**. This is expected until a Xero app is registered and secrets are configured.
