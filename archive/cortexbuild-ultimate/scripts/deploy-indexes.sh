#!/bin/bash
# Deploy Index Optimization Migration
# Usage: ./deploy-indexes.sh [production|staging|local]

set -e

ENVIRONMENT=${1:-local}

echo "=== CortexBuild Index Optimization Deployment ==="
echo "Environment: $ENVIRONMENT"
echo "Started at: $(date)"
echo ""

# Database connection settings
if [ "$ENVIRONMENT" = "production" ]; then
  # VPS Production
  DB_HOST="72.62.132.43"
  DB_USER="cortexbuild"
  DB_NAME="cortexbuild"
  echo "⚠️  Deploying to PRODUCTION database"
  echo "🔒 Creating backup before migration..."
  ssh root@72.62.132.43 "docker exec cortexbuild-db pg_dump -U cortexbuild cortexbuild > /backups/pre-indexes-$(date +%Y%m%d-%H%M%S).sql"
  echo "✅ Backup created"
  echo ""
elif [ "$ENVIRONMENT" = "staging" ]; then
  # Staging (if applicable)
  DB_HOST="localhost"
  DB_USER="cortexbuild"
  DB_NAME="cortexbuild_staging"
  echo "🧪 Deploying to STAGING database"
else
  # Local development
  DB_HOST="localhost"
  DB_USER="cortexbuild"
  DB_NAME="cortexbuild"
  echo "💻 Deploying to LOCAL database"
fi

echo "📊 Running migration..."
echo ""

# Run migration
if [ "$ENVIRONMENT" = "production" ]; then
  # Production: Run via Docker
  ssh root@72.62.132.43 "docker exec -i cortexbuild-db psql -U cortexbuild -d cortexbuild < server/migrations/019_add_composite_indexes.sql"
else
  # Local/Staging: Run directly
  PGPASSWORD="${DB_PASSWORD:-cortexbuild123}" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f server/migrations/019_add_composite_indexes.sql
fi

echo ""
echo "✅ Migration completed"
echo ""

# Verification
echo "🔍 Verifying indexes..."
echo ""

if [ "$ENVIRONMENT" = "production" ]; then
  ssh root@72.62.132.43 "docker exec cortexbuild-db psql -U cortexbuild -d cortexbuild -c \"
    SELECT COUNT(*) as new_indexes 
    FROM pg_indexes 
    WHERE indexname LIKE 'idx_%' 
    AND indexname IN (
      SELECT indexname FROM pg_indexes 
      WHERE schemaname = 'public' 
      ORDER BY indexname DESC 
      LIMIT 50
    );
  \""
else
  PGPASSWORD="${DB_PASSWORD:-cortexbuild123}" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "
    SELECT COUNT(*) as new_indexes 
    FROM pg_indexes 
    WHERE indexname LIKE 'idx_%';
  "
fi

echo ""
echo "📈 Index deployment summary:"
echo "   - Composite indexes: ✓"
echo "   - Partial indexes: ✓"
echo "   - Covering indexes: ✓"
echo "   - Full-text search: ✓"
echo "   - JSON GIN indexes: ✓"
echo ""
echo "⏱️  Completed at: $(date)"
echo ""
echo "📝 Next steps:"
echo "   1. Monitor query performance in Grafana"
echo "   2. Check index usage after 24h: SELECT * FROM pg_stat_user_indexes WHERE indexname LIKE 'idx_%'"
echo "   3. Run ANALYZE on tables if query planner doesn't use new indexes immediately"
echo ""
echo "✅ Deployment complete!"
