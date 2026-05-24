#!/usr/bin/env bash
# CortexBuild Ultimate - Backup Script
# Usage: ./scripts/backup.sh

set -euo pipefail

BACKUP_DIR="$HOME/backups/cortexbuild/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 Starting backup to $BACKUP_DIR..."

# Database backup
echo "1. Backing up database..."
pg_dump -h 127.0.0.1 -U cortexbuild cortexbuild > "$BACKUP_DIR/cortexbuild.sql" 2>/dev/null && echo "   ✅ Database backed up" || echo "   ⚠️ Database backup skipped (not running locally)"

# Docker volumes
echo "2. Backing up Docker volumes..."
for vol in postgres_data redis_data; do
  docker run --rm -v "$vol:/data" -v "$BACKUP_DIR:/backup" alpine tar czf "/backup/${vol}.tar.gz" -C /data . 2>/dev/null && echo "   ✅ $vol" || echo "   ⚠️ $vol skipped"
done

# Configuration files
echo "3. Backing up configuration..."
cp ~/.hermes/config.yaml "$BACKUP_DIR/hermes-config.yaml" 2>/dev/null || true
cp ~/.hermes/.env "$BACKUP_DIR/hermes-env.txt" 2>/dev/null || true

# Cleanup old backups (>7 days)
echo "4. Cleaning old backups..."
find "$HOME/backups/cortexbuild" -maxdepth 1 -type d -mtime +7 -exec rm -rf {} + 2>/dev/null || true

echo ""
echo "✅ Backup complete: $BACKUP_DIR"
du -sh "$BACKUP_DIR"
