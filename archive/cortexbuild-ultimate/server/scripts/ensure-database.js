/**
 * One-shot bootstrap for empty Postgres (Docker / local compose).
 * Dynamically discovers and runs all migrations in server/migrations/
 * in filename order. Seed runs after prerequisite migrations.
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { databaseUrlWantsSsl, effectiveDatabaseUrl } = require('../lib/pgConnectionEnv');

function resolveSqlPaths() {
  const repoRoot = path.join(__dirname, '..', '..');
  if (fs.existsSync(path.join(repoRoot, 'server', 'migrations', '000_platform_core.sql'))) {
    return {
      setup: path.join(repoRoot, 'server', 'scripts', 'setup.sql'),
      seed: path.join(repoRoot, 'server', 'scripts', 'seed.sql'),
      migDir: path.join(repoRoot, 'server', 'migrations'),
    };
  }
  const appRoot = path.join(__dirname, '..');
  if (fs.existsSync(path.join(appRoot, 'migrations', '000_platform_core.sql'))) {
    return {
      setup: path.join(appRoot, 'scripts', 'setup.sql'),
      seed: path.join(appRoot, 'scripts', 'seed.sql'),
      migDir: path.join(appRoot, 'migrations'),
    };
  }
  throw new Error('[ensure-database] Cannot locate server/migrations (wrong cwd or incomplete image)');
}

function pgClientConfig() {
  const databaseUrl = effectiveDatabaseUrl();
  if (databaseUrl) {
    const useSsl = databaseUrlWantsSsl(databaseUrl);
    const ssl = useSsl
      ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true' }
      : false;
    return { connectionString: databaseUrl, ssl };
  }
  const password = process.env.DB_PASSWORD;
  if (!password) {
    console.error('[ensure-database] DB_PASSWORD or DATABASE_URL is required');
    process.exit(1);
  }
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'cortexbuild',
    user: process.env.DB_USER || 'cortexbuild',
    password,
    ssl: false,
  };
}

async function runSqlFile(client, filePath) {
  console.log(`[ensure-database] Running ${path.basename(filePath)}...`);
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    await client.query(sql);
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log(`[ensure-database] Missing file, skipping: ${filePath}`);
      return;
    }
    console.error(`[ensure-database] Error in ${path.basename(filePath)}: ${e.message}`);
    throw e;
  }
}

async function isBootstrapped(client) {
  const r = await client.query(`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'totp_enabled'
      ) AS auth_cols,
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'autoresearch_jobs'
      ) AS worker_tables;
  `);
  return Boolean(r.rows[0]?.auth_cols && r.rows[0]?.worker_tables);
}

async function getMigrationFiles(migDir) {
  return fs
    .readdirSync(migDir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function main() {
  const paths = resolveSqlPaths();
  const client = new Client(pgClientConfig());
  await client.connect();
  console.log('[ensure-database] Connected to Postgres');

  if (await isBootstrapped(client)) {
    console.log('[ensure-database] Schema already present (auth + worker tables). Skipping.');
    await client.end();
    return;
  }

  console.log('[ensure-database] Bootstrapping schema and seed data...');

  // setup.sql creates the DB if needed; skip if connected directly.
  try {
    await runSqlFile(client, paths.setup);
  } catch (e) {
    console.log('[ensure-database] setup.sql skipped (may already exist):', e.message);
  }

  const migrations = await getMigrationFiles(paths.migDir);
  console.log(`[ensure-database] Discovered ${migrations.length} migrations`);

  let seedInserted = false;
  for (const mig of migrations) {
    const migPath = path.join(paths.migDir, mig);
    await runSqlFile(client, migPath);

    // Seed data must run after 016_local_dev_reconcile.sql which adds columns required by seed.
    if (mig.startsWith('016_') && !seedInserted) {
      try {
        await runSqlFile(client, paths.seed);
        seedInserted = true;
      } catch (e) {
        console.log('[ensure-database] seed.sql skipped:', e.message);
      }
    }
  }

  if (!seedInserted) {
    try {
      await runSqlFile(client, paths.seed);
    } catch (e) {
      console.log('[ensure-database] seed.sql skipped:', e.message);
    }
  }

  await client.end();
  console.log('[ensure-database] Bootstrap complete.');
}

main().catch((err) => {
  console.error('[ensure-database] Failed:', err);
  process.exit(1);
});
