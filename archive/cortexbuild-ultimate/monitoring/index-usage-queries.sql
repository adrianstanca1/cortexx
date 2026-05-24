-- CortexBuild Index Monitoring Queries
-- Use these to monitor index usage and performance after deployment
-- Run periodically to identify unused indexes or performance issues

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. INDEX USAGE STATISTICS
-- Check which indexes are being used and how often
-- ─────────────────────────────────────────────────────────────────────────────

-- All indexes with usage stats
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. UNUSED INDEXES (Candidates for removal)
-- Indexes that haven't been scanned - may be safe to drop
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
  AND indexname NOT LIKE '%_pkey'
  AND indexname LIKE 'idx_%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. INDEX SIZE REPORT
-- Largest indexes by size
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  idx_scan as scans,
  idx_tup_read as tuples_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. NEWLY CREATED INDEX USAGE
-- Check if our new composite indexes are being used
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  indexname,
  tablename,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE indexname LIKE 'idx_%composite%'
   OR indexname LIKE 'idx_%covering%'
   OR indexname LIKE 'idx_%search_vector%'
ORDER BY idx_scan DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. TABLE SCAN vs INDEX SCAN
-- Identify tables doing sequential scans (may need indexes)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  relname as table_name,
  seq_scan as sequential_scans,
  seq_tup_read as seq_tuples_read,
  idx_scan as index_scans,
  idx_tup_fetch as index_tuples_fetched,
  CASE 
    WHEN seq_scan > 0 AND idx_scan > 0 
    THEN ROUND(100.0 * idx_scan / (seq_scan + idx_scan), 2)
    ELSE 0 
  END as index_usage_pct
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan DESC
LIMIT 20;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. SLOW QUERIES (May need new indexes)
-- Queries with high total time (requires pg_stat_statements)
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable if pg_stat_statements is installed:
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

SELECT 
  query,
  calls,
  ROUND(total_exec_time::numeric, 2) as total_ms,
  ROUND(mean_exec_time::numeric, 2) as mean_ms,
  rows
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY total_exec_time DESC
LIMIT 10;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. INDEX BLOAT (Wasted space)
-- Check if indexes need REINDEX
-- ─────────────────────────────────────────────────────────────────────────────

SELECT
  nspname as schema_name,
  relname as index_name,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  idx_scan as index_scans
FROM pg_stat_user_indexes
JOIN pg_index USING (indexrelid)
JOIN pg_class ON pg_class.oid = pg_index.indrelid
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. FULL-TEXT SEARCH INDEX STATS
-- Check GIN index usage for search vectors
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  indexname,
  tablename,
  idx_scan as searches,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE indexname LIKE '%search_vector%'
ORDER BY idx_scan DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. PARTIAL INDEX EFFECTIVENESS
-- Check if partial indexes are being used
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  indexname,
  tablename,
  idx_scan as scans,
  idx_tup_read as tuples_read
FROM pg_stat_user_indexes
WHERE indexname LIKE '%active%'
   OR indexname LIKE '%pending%'
   OR indexname LIKE '%valid%'
ORDER BY idx_scan DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. COVERING INDEX BENEFIT
-- Check if covering indexes are avoiding heap lookups
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  indexname,
  tablename,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  CASE 
    WHEN idx_scan > 0 THEN ROUND(idx_tup_read::numeric / idx_scan, 2)
    ELSE 0 
  END as avg_tuples_per_scan
FROM pg_stat_user_indexes
WHERE indexname LIKE '%covering%'
ORDER BY idx_scan DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. DAILY INDEX USAGE CHANGE
-- Compare current stats with previous day (requires historical data)
-- Store this query result daily in a monitoring table
-- ─────────────────────────────────────────────────────────────────────────────

-- Create monitoring table (run once)
CREATE TABLE IF NOT EXISTS index_usage_history (
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  indexname TEXT,
  tablename TEXT,
  idx_scan BIGINT,
  idx_tup_read BIGINT,
  index_size BIGINT
);

-- Insert current stats (run daily via cron)
INSERT INTO index_usage_history (indexname, tablename, idx_scan, idx_tup_read, index_size)
SELECT 
  indexname,
  tablename,
  idx_scan,
  idx_tup_read,
  pg_relation_size(indexrelid)
FROM pg_stat_user_indexes
WHERE schemaname = 'public';

-- Compare with yesterday
SELECT 
  curr.indexname,
  curr.idx_scan - prev.idx_scan as new_scans,
  curr.idx_tup_read - prev.idx_tup_read as new_tuples_read
FROM index_usage_history curr
JOIN index_usage_history prev 
  ON curr.indexname = prev.indexname
  AND curr.recorded_at > prev.recorded_at
WHERE prev.recorded_at >= NOW() - INTERVAL '2 days'
  AND curr.recorded_at >= NOW() - INTERVAL '1 day'
ORDER BY new_scans DESC
LIMIT 20;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. RECOMMENDATIONS QUERY
-- Automated index recommendations based on usage patterns
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  tablename,
  CASE 
    WHEN seq_scan > 1000 AND idx_scan = 0 
    THEN '⚠️  High sequential scans, no indexes - consider adding indexes'
    WHEN seq_scan > idx_scan * 10 
    THEN '⚠️  Sequential scans much higher than index scans - review indexes'
    WHEN idx_scan = 0 AND index_size > 1024 * 1024 * 10  -- 10MB
    THEN '⚠️  Large unused index - consider dropping'
    ELSE '✓ OK'
  END as recommendation
FROM pg_stat_user_tables t
JOIN pg_stat_user_indexes i USING (tablename)
WHERE t.schemaname = 'public'
ORDER BY seq_scan DESC
LIMIT 20;

-- ─────────────────────────────────────────────────────────────────────────────
-- QUICK HEALTH CHECK
-- Run this for a quick overview
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  'Total Indexes' as metric,
  COUNT(*) as value
FROM pg_indexes
WHERE schemaname = 'public'
UNION ALL
SELECT 
  'New Indexes (idx_*)',
  COUNT(*)
FROM pg_indexes
WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
UNION ALL
SELECT 
  'Unused Indexes',
  COUNT(*)
FROM pg_stat_user_indexes
WHERE schemaname = 'public' AND idx_scan = 0 AND indexname NOT LIKE '%_pkey'
UNION ALL
SELECT 
  'Total Index Size',
  pg_size_pretty(SUM(pg_relation_size(indexrelid)))
FROM pg_stat_user_indexes
WHERE schemaname = 'public';
