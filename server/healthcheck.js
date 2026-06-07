const { Pool } = require('pg');
const http = require('http');

async function checkPostgres() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://localhost/cortexx' });
  try {
    const res = await pool.query('SELECT 1 as healthy');
    return res.rows[0].healthy === 1;
  } catch (err) {
    console.error('Postgres check failed:', err.message);
    return false;
  } finally {
    await pool.end();
  }
}

async function checkSupabase() {
  const url = process.env.SUPABASE_URL;
  if (!url) return 'Skipped (no SUPABASE_URL)';
  try {
    const res = await fetch(`${url}/auth/v1/health`);
    return res.ok;
  } catch (err) {
    console.error('Supabase check failed:', err.message);
    return false;
  }
}

async function checkMinio() {
  const endpoint = process.env.S3_ENDPOINT || process.env.MINIO_ENDPOINT;
  if (!endpoint) return 'Skipped (no S3_ENDPOINT)';
  try {
    const res = await fetch(`${endpoint}/minio/health/live`);
    return res.ok;
  } catch (err) {
    console.error('MinIO check failed:', err.message);
    return false;
  }
}

async function run() {
  console.log('--- Health Check ---');
  console.log('PostgreSQL:', await checkPostgres() ? 'OK' : 'FAIL');
  console.log('Supabase Auth:', await checkSupabase());
  console.log('MinIO Storage:', await checkMinio());
}

run();
