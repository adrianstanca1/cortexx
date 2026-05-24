# Index Optimization Deployment Guide

## Overview

This migration adds **comprehensive database indexing** to improve query performance across all CortexBuild modules.

**Expected Performance Improvements:**
- Dashboard queries: **5-50x faster**
- Multi-column filters: **10-100x faster**
- Full-text search: **100-1000x faster**
- Date range queries: **3-10x faster**

---

## Files Added

| File | Purpose |
|------|---------|
| `server/migrations/019_add_composite_indexes.sql` | Main migration SQL |
| `scripts/deploy-indexes.sh` | Deployment script |
| `monitoring/index-usage-queries.sql` | Performance monitoring |
| `docs/INDEX_OPTIMIZATION.md` | This guide |

---

## What's Included

### Phase 1: Critical Composite Indexes (20 indexes)
- Projects: company + status, manager + status
- Tasks: assignee + status, project + status + priority
- RFIs: project + status + priority, assigned + status
- Safety: project + severity + status
- Documents: project + type + discipline
- And 15 more...

### Phase 2: Partial Indexes (10 indexes)
- Active users only
- Open RFIs only
- Active tasks only
- Current document revisions
- Valid sessions only

### Phase 3: Covering Indexes (10 indexes)
- Project dashboard KPIs (no heap lookup)
- Task list view
- RFI list view
- Document list view
- Safety incident list

### Phase 4: Date Range Indexes (8 indexes)
- Calendar event queries
- Financial reporting
- Audit trail (90-day hot data)

### Phase 5: Full-Text Search (6 indexes)
- Projects search
- RFIs search
- Documents search
- Safety incidents search
- Tasks search
- Subcontractors search

### Phase 6: JSON GIN Indexes (3 indexes)
- User permissions
- Workflow nodes
- Workflow triggers

### Phase 7: Specialized Indexes (10 indexes)
- Equipment service tracking
- Risk register high priority
- Defects by priority
- Invoices receivable
- Tenders bid queue
- CRM pipeline

**Total: 67 new indexes**

---

## Deployment Steps

### Option 1: Automated Script (Recommended)

```bash
# Local development
cd /Users/adrianstanca/cortexbuild-ultimate
./scripts/deploy-indexes.sh local

# Production (via VPS)
./scripts/deploy-indexes.sh production
```

### Option 2: Manual Deployment

```bash
# Local
psql -h localhost -U cortexbuild -d cortexbuild \
  -f server/migrations/019_add_composite_indexes.sql

# Production VPS
docker exec -i cortexbuild-db psql -U cortexbuild -d cortexbuild \
  < server/migrations/019_add_composite_indexes.sql
```

### Option 3: Migration Command

```bash
# If using Prisma migrations
cd cortexbuild-ultimate
npx prisma migrate dev --name add_composite_indexes
```

---

## Pre-Deployment Checklist

- [ ] Backup database (automatic in production script)
- [ ] Test on local/staging environment first
- [ ] Schedule deployment during low-traffic period
- [ ] Notify users of potential brief slowdown
- [ ] Have rollback plan ready

---

## Post-Deployment Verification

### 1. Check Index Count

```sql
SELECT COUNT(*) 
FROM pg_indexes 
WHERE indexname LIKE 'idx_%';
-- Should show 67 new indexes
```

### 2. Verify Index Sizes

```sql
SELECT 
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE indexname LIKE 'idx_%'
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;
```

### 3. Test Query Performance

```sql
-- Before: Sequential scan
EXPLAIN ANALYZE 
SELECT * FROM projects 
WHERE company_id = 'xxx' AND status = 'ACTIVE';

-- After: Index scan
-- Should show "Index Scan using idx_projects_company_status"
```

### 4. Monitor Index Usage

After 24-48 hours, check usage:

```sql
SELECT 
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read
FROM pg_stat_user_indexes
WHERE indexname LIKE 'idx_%composite%'
ORDER BY idx_scan DESC;
```

---

## Rollback Plan

If issues occur, drop specific indexes:

```sql
-- Drop all new indexes (if needed)
DROP INDEX IF EXISTS idx_projects_company_status;
DROP INDEX IF EXISTS idx_tasks_assignee_status;
DROP INDEX IF EXISTS idx_rfis_project_status_priority;
-- ... etc

-- Or drop by pattern
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT indexname FROM pg_indexes 
           WHERE indexname LIKE 'idx_%' 
           AND indexname NOT LIKE '%_pkey'
  LOOP
    EXECUTE 'DROP INDEX IF EXISTS ' || r.indexname;
  END LOOP;
END$$;
```

---

## Performance Monitoring

### Daily Checks

```bash
# Run monitoring queries
psql -h localhost -U cortexbuild -d cortexbuild \
  -f monitoring/index-usage-queries.sql
```

### Grafana Dashboard

If you have Grafana set up:
1. Add "Index Usage" panel
2. Query: `SELECT idx_scan FROM pg_stat_user_indexes WHERE indexname LIKE 'idx_%'`
3. Set alerts for unused indexes > 10MB

### Weekly Report

Run this weekly to identify optimization opportunities:

```sql
-- Unused large indexes (candidates for removal)
SELECT 
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE idx_scan = 0 
  AND indexname NOT LIKE '%_pkey'
  AND pg_relation_size(indexrelid) > 10485760  -- 10MB
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## Expected Database Size Impact

**Index Storage Estimate:**
- Current database: ~500MB (example)
- New indexes: +50-100MB
- Total increase: ~10-20%

**Trade-off:** Slightly more disk space for significantly faster queries.

---

## Troubleshooting

### Issue: Migration fails with "index already exists"

**Solution:** Migration uses `CREATE INDEX IF NOT EXISTS` - safe to re-run.

### Issue: Queries still slow after migration

**Solutions:**
1. Run `ANALYZE` on affected tables
2. Check `EXPLAIN ANALYZE` to verify index usage
3. Wait 24h for statistics to update
4. Check if query matches index columns exactly

### Issue: Out of disk space during migration

**Solution:** 
1. Run `VACUUM FULL` before migration
2. Drop unused indexes first
3. Migrate in batches (Phases 1-3, then 4-7)

### Issue: Lock contention during deployment

**Solution:** 
- Deploy during maintenance window
- Use `CONCURRENTLY` option for production:
  ```sql
  CREATE INDEX CONCURRENTLY idx_name ON table(column);
  ```

---

## Next Steps After Deployment

1. **Day 1:** Monitor error logs and query performance
2. **Day 2-3:** Check index usage statistics
3. **Week 1:** Identify and remove unused indexes
4. **Week 2:** Fine-tune based on query patterns
5. **Ongoing:** Monthly index health checks

---

## Support

For issues or questions:
- Check `monitoring/index-usage-queries.sql` for diagnostics
- Review PostgreSQL index documentation
- Consult with database team for complex optimizations

---

**Last Updated:** 2026-04-01  
**Migration Version:** 019  
**Total Indexes:** 67
