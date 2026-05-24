const { Pool } = require('pg');
const pool = new Pool();

// Mock ALLOWED_TABLES for benchmarking
const ALLOWED_TABLES = [
  'projects', 'invoices', 'safety_incidents', 'rfis', 'change_orders',
  'team_members', 'equipment', 'subcontractors', 'documents', 'timesheets',
  'meetings', 'materials', 'punch_list', 'inspections', 'rams', 'cis_returns',
  'tenders', 'contacts', 'risk_register', 'purchase_orders', 'daily_reports',
  'variations', 'defects', 'valuations', 'specifications', 'temp_works',
  'signage', 'waste_management', 'sustainability', 'training',
  'certifications', 'prequalification', 'lettings', 'measuring',
  'notifications', 'users', 'audit_log'
];

async function runBenchmark() {
  console.log('Starting benchmark...');

  // N+1 Sequential approach (Current)
  const startSequential = process.hrtime();
  const allDataSeq = {};
  for (const table of ALLOWED_TABLES) {
    try {
      // Use pg_sleep to simulate query latency (e.g., 10ms per table)
      const result = await pool.query(`SELECT pg_sleep(0.01)`);
      allDataSeq[table] = { count: result.rowCount, rows: [] };
    } catch (err) {
      allDataSeq[table] = { count: 0, rows: [], error: 'table not found' };
    }
  }
  const endSequential = process.hrtime(startSequential);
  const timeSequential = endSequential[0] * 1000 + endSequential[1] / 1000000;

  console.log(`Sequential N+1 query time: ${timeSequential.toFixed(2)} ms`);

  // Parallel approach (Proposed)
  const startParallel = process.hrtime();
  const allDataPar = {};

  // Run queries in parallel
  const promises = ALLOWED_TABLES.map(async (table) => {
    try {
      const result = await pool.query(`SELECT pg_sleep(0.01)`);
      return { table, count: result.rowCount, rows: [] };
    } catch (err) {
      return { table, count: 0, rows: [], error: 'table not found' };
    }
  });

  const results = await Promise.all(promises);
  for (const result of results) {
    const { table, ...data } = result;
    allDataPar[table] = data;
  }

  const endParallel = process.hrtime(startParallel);
  const timeParallel = endParallel[0] * 1000 + endParallel[1] / 1000000;

  console.log(`Parallel Promise.all time: ${timeParallel.toFixed(2)} ms`);
  console.log(`Speedup: ${(timeSequential / timeParallel).toFixed(2)}x`);

  await pool.end();
}

runBenchmark().catch(console.error);
