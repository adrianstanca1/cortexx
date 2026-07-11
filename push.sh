#!/bin/bash
# Final push to GitHub — CortexBuild Pro v1.0.0

set -e

echo "🚀 CortexBuild Pro — Final Push to GitHub"
echo "=========================================="
echo ""

# Verify we're in the right directory
if [ ! -f "Cortexx.html" ]; then
  echo "❌ Error: Cortexx.html not found. Are you in the project root?"
  exit 1
fi

# Stage all changes
echo "📦 Staging changes..."
git add Cortexx.html lib/ dist/ ops/ *.md sw.js manifest.json 2>/dev/null || true
git add DEPLOYMENT_STATUS.md ROADMAP.md STATUS.md 2>/dev/null || true

# Show what's being committed
echo ""
echo "📋 Changes to commit:"
git diff --cached --stat

echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

# Commit
echo ""
echo "📝 Committing..."
git commit -m "v1.0.0: CortexBuild Pro PWA — Production Release

✅ Features:
• 98 modules compiled and synced (lib/ → dist/)
• 15 dashboard variations + 85+ feature screens
• 58-table database with full CRUD
• AI features: receipt OCR, task draft, invoice chase, photo annotation
• Offline-first PWA with service worker
• Production mode: precompiled dist/ (zero Babel cost)
• Dev mode: JSX from lib/ with ?dev=1 flag

✅ Infrastructure:
• Standalone HTML deployment (no build step)
• Custom VPS deployment script (nginx + SSL)
• Docker-compose for Postgres
• GitHub Actions CI/CD ready

✅ Fixes in this release:
• Fixed 7 missing sheet renderers (addtemplate, addview, addcost, addchangeorder, adddiaryentry, addfeedback, addcheckin)
• Fixed T/window.T scope issue in phase110/111
• Fixed hardcoded dates in seed data
• Synced lib/ ↔ dist/ perfectly (98 modules)
• Updated service worker cache (phases 100-111)
• Fixed nav aliases to correct sheet handlers

See DEPLOYMENT_STATUS.md for next steps." || echo "Commit failed"

# Push
echo ""
echo "🚀 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ Push complete!"
echo ""
echo "📊 View commits: https://github.com/adrianstanca1/cortexx/commits/main"
echo "📦 View releases: https://github.com/adrianstanca1/cortexx/releases"
echo ""
echo "Next: Deploy to VPS (see DEPLOYMENT_STATUS.md)"
