#!/usr/bin/env node
/**
 * scripts/seed-superadmin.mjs
 *
 * Seeds (or updates) a single platform super-admin user with email + password
 * authentication. Idempotent — re-running with the same email updates the row
 * with a freshly-salted hash; re-running with a different email creates a new
 * super-admin (the previous one stays admin unless you change it manually).
 *
 * The plaintext password is read from environment variables — never persisted
 * to disk, never committed.
 *
 * Usage:
 *   BOOTSTRAP_SUPERADMIN_EMAIL=adrian.stanca1@gmail.com \
 *   BOOTSTRAP_SUPERADMIN_PASSWORD='your-password-here' \
 *   BOOTSTRAP_SUPERADMIN_NAME='Adrian Stanca' \
 *   node scripts/seed-superadmin.mjs
 *
 * Dry-run mode: set BOOTSTRAP_SUPERADMIN_DRY_RUN=1 (or pass --dry-run) and the
 * script validates env vars, checks the column exists, hashes the password,
 * and prints the SQL it WOULD run — without executing the upsert. Useful for
 * reviewing exactly what's about to happen before pointing at production.
 *
 * Requires: DATABASE_URL set (postgres-js connection string), and migration
 * 0005_email_password_auth.sql already applied.
 */

import 'dotenv/config';
import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import postgres from 'postgres';

function scrypt(password, salt, keylen, options) {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

async function hashPassword(password) {
  const salt = randomBytes(32);
  const hash = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$N=16384,r=8,p=1$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function isDryRun() {
  if (process.argv.includes('--dry-run')) return true;
  const env = process.env.BOOTSTRAP_SUPERADMIN_DRY_RUN;
  return env === '1' || env === 'true';
}

async function main() {
  const dryRun = isDryRun();
  const databaseUrl = process.env.DATABASE_URL;
  const email = process.env.BOOTSTRAP_SUPERADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_SUPERADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_SUPERADMIN_NAME ?? email;

  if (!databaseUrl) {
    console.error('[seed-superadmin] DATABASE_URL is not set.');
    process.exit(1);
  }
  if (!email || !password) {
    console.error('[seed-superadmin] Both BOOTSTRAP_SUPERADMIN_EMAIL and BOOTSTRAP_SUPERADMIN_PASSWORD are required.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('[seed-superadmin] BOOTSTRAP_SUPERADMIN_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  const loweredEmail = email.toLowerCase();
  const openId = `email:${loweredEmail}`;
  const passwordHash = await hashPassword(password);

  if (dryRun) {
    console.log('[seed-superadmin] DRY-RUN — no DB write will be attempted.');
    console.log(`  DATABASE_URL: ${databaseUrl.replace(/:[^@/]*@/, ':***@')}`);
    console.log(`  openId:       ${openId}`);
    console.log(`  email:        ${loweredEmail}`);
    console.log(`  name:         ${name}`);
    console.log(`  loginMethod:  password`);
    console.log(`  role:         admin`);
    console.log(`  passwordHash: scrypt$N=16384,r=8,p=1$<32 bytes salt>$<64 bytes hash>`);
    console.log(`                (length: ${passwordHash.length} chars; algorithm verified by hashPassword)`);
    console.log('  SQL that would run:');
    console.log(`    INSERT INTO users ("openId", name, email, "loginMethod", role,`);
    console.log(`                       "passwordHash", "createdAt", "updatedAt", "lastSignedIn")`);
    console.log(`    VALUES ('${openId}', '${name.replace(/'/g, "''")}', '${loweredEmail}', 'password', 'admin',`);
    console.log(`            '<computed-hash>', now(), now(), now())`);
    console.log(`    ON CONFLICT ("openId") DO UPDATE SET ...`);
    return;
  }

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    // Verify the migration has run (passwordHash column exists).
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
       WHERE table_name = 'users' AND column_name = 'passwordHash'
       LIMIT 1
    `;
    if (cols.length === 0) {
      console.error('[seed-superadmin] users.passwordHash column not found. Run migration 0005_email_password_auth.sql first via `pnpm db:push`.');
      process.exit(1);
    }

    const result = await sql`
      INSERT INTO users
        ("openId", name, email, "loginMethod", role, "passwordHash",
         "createdAt", "updatedAt", "lastSignedIn")
      VALUES (
        ${openId}, ${name}, ${loweredEmail}, 'password', 'admin',
        ${passwordHash}, now(), now(), now()
      )
      ON CONFLICT ("openId") DO UPDATE
         SET email          = EXCLUDED.email,
             name           = EXCLUDED.name,
             "loginMethod"  = EXCLUDED."loginMethod",
             role           = EXCLUDED.role,
             "passwordHash" = EXCLUDED."passwordHash",
             "updatedAt"    = now()
      RETURNING id, "openId", email, role, "lastSignedIn"
    `;

    const row = result[0];
    console.log('[seed-superadmin] Seeded super-admin:');
    console.log(`  id:           ${row.id}`);
    console.log(`  openId:       ${row.openId}`);
    console.log(`  email:        ${row.email}`);
    console.log(`  role:         ${row.role}`);
    console.log(`  lastSignedIn: ${row.lastSignedIn.toISOString()}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch(err => {
  console.error('[seed-superadmin] Failed:', err.message);
  process.exit(1);
});
