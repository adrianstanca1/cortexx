// Cortexx API — shared security helpers for the generic /api/:collection CRUD.
//
// The generic collection REST handlers in server/index.js expose EVERY
// collection name an authenticated user cares to send as a REST resource.
// Typed names map to first-class tables (see NATIVE / TYPED_JSONB in
// index.js); everything else falls through to the documents_store JSONB
// namespace. To keep sensitive/system tables (and their names) off the
// generic path entirely, we maintain an explicit denylist here and reject
// any request whose collection matches — BEFORE any SQL runs.
//
// Kept as a standalone, dependency-free module so the pure predicate
// `isRestrictedCollection` can be unit-tested without booting Express or a DB.

// Raw/system tables that must NEVER be reachable through the generic route.
// These hold credentials, tenant-admin state, auth material, immutable audit
// records, or third-party integration secrets. They each have (or should
// have) their own purpose-built, separately-authorised routes.
//
// Names are matched case-insensitively and cover BOTH the camelCase
// collection alias a client might send AND the underlying snake_case table
// name, so neither spelling slips through.
const RESTRICTED_COLLECTIONS = new Set([
  // ── Tenancy & auth ──────────────────────────────────────────
  'users',              // password hashes, roles, PII
  'workspaces',         // tenant records / plan / suspension flags
  'magic_links',        // passwordless login tokens
  'magiclinks',
  'portal_tokens',      // client-portal share tokens (grant project access)
  'portaltokens',
  'api_keys',           // API credentials (reserved — future table)
  'apikeys',
  // ── Audit / integrity ───────────────────────────────────────
  'audit_log',          // immutable hash-chained audit trail
  'auditlog',
  'audit',              // camelCase alias used by the app's audit route
  'sync_log',           // sync bookkeeping (internal)
  'synclog',
  // ── Integration secrets (tokens/entitlements at rest) ───────
  'bank_connections',   // OAuth access/refresh tokens (encrypted, still off-limits)
  'bankconnections',
  'iap_entitlements',   // subscription entitlement state
  'iapentitlements',
  'hmrc_submissions',   // HMRC filing payloads (request/response XML)
  'hmrcsubmissions',
  'push_subscriptions', // device push endpoints
  'pushsubscriptions',
  // ── AI memory (may contain sensitive prompts) ───────────────
  'ai_history',
  'aihistory',
]);

// Pure predicate — safe to unit-test in isolation (no auth, no DB, no Express).
function isRestrictedCollection(name) {
  if (typeof name !== 'string') return false;
  return RESTRICTED_COLLECTIONS.has(name.trim().toLowerCase());
}

module.exports = { RESTRICTED_COLLECTIONS, isRestrictedCollection };
