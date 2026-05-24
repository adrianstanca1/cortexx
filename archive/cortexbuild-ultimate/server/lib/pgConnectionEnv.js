/**
 * Shared rules for Postgres TLS — keep server/db.js and scripts/ensure-database.js in sync.
 * Managed Postgres hostnames typically need TLS; local Docker / loopback stay non-TLS unless the URL or env requests SSL.
 */
function databaseUrlWantsSsl(connectionString) {
  if (!connectionString) return process.env.NODE_ENV === 'production';
  const lower = connectionString.toLowerCase();
  if (lower.includes('sslmode=disable')) return false;
  if (
    lower.includes('sslmode=require') ||
    lower.includes('sslmode=verify-full') ||
    lower.includes('sslmode=no-verify') ||
    lower.includes('sslmode=prefer')
  ) {
    return true;
  }
  if (process.env.DATABASE_SSL === 'true' || process.env.DATABASE_SSL === '1') return true;
  if (process.env.NODE_ENV === 'production') return true;
  if (/\.(neon\.tech|railway\.app|amazonaws\.com|render\.com|render\.internal)\b/i.test(connectionString)) {
    return true;
  }
  if (/render/i.test(connectionString) && /postgres|\.internal\b/i.test(connectionString)) {
    return true;
  }
  return false;
}

/** Treat blank / whitespace-only DATABASE_URL as unset (compose or shell can leave ""). */
function effectiveDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (raw == null) return '';
  const t = String(raw).trim();
  return t;
}

module.exports = { databaseUrlWantsSsl, effectiveDatabaseUrl };
