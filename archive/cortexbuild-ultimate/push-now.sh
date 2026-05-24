#!/bin/bash
# Run this from your Mac terminal to clear locks, commit restored files, and push
# Usage: cd ~/path/to/cortexbuild-ultimate && bash push-now.sh

set -e
echo "Clearing git lock files..."
rm -f .git/HEAD.lock .git/index.lock .git/index.stash.*.lock 2>/dev/null || true

echo "Staging restored expanded modules..."
git add src/components/modules/AIVision.tsx \
        src/components/modules/AuditLog.tsx \
        src/components/modules/CostManagement.tsx \
        src/components/modules/ExecutiveReports.tsx \
        src/components/modules/GlobalSearch.tsx \
        src/components/modules/Inspections.tsx \
        src/components/modules/PermissionsManager.tsx

echo "Committing..."
git commit -m "fix: restore 7 expanded modules reverted by TASKS.md sync commit

Re-applies expansions accidentally reverted. All modules now at full size:
- AIVision (957 lines): History, Insights, Settings tabs
- AuditLog (752 lines): Security Events, Data Changes, Compliance tabs
- CostManagement (895 lines): Commitments, Cost Codes, Forecasting tabs
- ExecutiveReports (1058 lines): Board Pack, KPI Dashboard, Benchmarking, Scheduled tabs
- GlobalSearch (693 lines): Recent searches, saved searches, keyboard shortcuts, analytics
- Inspections (817 lines): Calendar, Analytics, Reports tabs
- PermissionsManager (781 lines): Permission Matrix, Users & Roles, Audit Trail tabs

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

echo "Pushing to origin/main..."
git push origin main

echo "✅ Done! All changes pushed."
