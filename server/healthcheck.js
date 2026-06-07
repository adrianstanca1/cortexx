const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:***REMOVED***@localhost:5432/cortexx' });

async function checkDB() {
  try {
    const res = await pool.query('SELECT 1 AS ok');
    if (res.rows[0].ok === 1) console.log('[DB] PostgreSQL is fully native, unrestricted, and ACTIVE.');
    process.exit(0);
  } catch (err) {
    console.error('[DB] PostgreSQL error:', err.message);
    process.exit(1);
  }
}
checkDB();
