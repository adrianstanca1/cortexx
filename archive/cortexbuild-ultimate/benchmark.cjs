const pool = require('./server/db');

async function run() {
  const t0 = Date.now();
  await pool.query('SELECT 1');
  const t1 = Date.now();
  console.log(`Time: ${t1 - t0}ms`);
  pool.end();
}

run();
