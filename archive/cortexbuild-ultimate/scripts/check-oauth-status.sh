#!/bin/bash
# OAuth Status Check - Monitor OAuth usage and errors in production

set -e

VPS="root@72.62.132.43"
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes -i $HOME/.ssh/id_ed25519_vps"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║       CortexBuild OAuth Status Report                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Check OAuth providers in database
echo "📊 OAuth Providers Linked:"
echo "─────────────────────────────────────────────────────────────"
ssh $SSH_OPTS $VPS "psql -h localhost -U cortexbuild -d cortexbuild -c \"SELECT provider, COUNT(*) as count, MIN(created_at) as first_use, MAX(created_at) as last_use FROM oauth_providers GROUP BY provider ORDER BY count DESC;\"" 2>/dev/null || echo "   No OAuth accounts linked yet"

echo ""
echo "👥 Recent User Sign-ups (Last 7 days):"
echo "─────────────────────────────────────────────────────────────"
ssh $SSH_OPTS $VPS "psql -h localhost -U cortexbuild -d cortexbuild -c \"SELECT email, created_at, CASE WHEN avatar_url IS NOT NULL THEN '✓' ELSE '' END as has_avatar FROM users WHERE created_at > NOW() - INTERVAL '7 days' ORDER BY created_at DESC LIMIT 10;\"" 2>/dev/null || echo "   Error fetching data"

echo ""
echo "🔍 OAuth Errors (Last 24 hours):"
echo "─────────────────────────────────────────────────────────────"
ERRORS=$(ssh $SSH_OPTS $VPS "docker logs --since 24h cortexbuild-api 2>&1 | grep -iE 'oauth|google|microsoft|passport|auth.*error' | tail -20" || echo "")
if [ -z "$ERRORS" ]; then
    echo "   ✅ No OAuth errors found"
else
    echo "$ERRORS"
fi

echo ""
echo "🌐 API Health:"
echo "─────────────────────────────────────────────────────────────"
HEALTH=$(curl -s https://www.cortexbuildpro.com/api/health)
echo "   $HEALTH"

echo ""
echo "🔐 OAuth Routes Available:"
echo "─────────────────────────────────────────────────────────────"
ssh $SSH_OPTS $VPS "docker exec cortexbuild-api grep -E 'router\.(get|post|delete).*google|microsoft' /app/routes/oauth.js 2>/dev/null | head -10" || echo "   Checking routes..."

echo ""
echo "📈 OAuth Migration Status:"
echo "─────────────────────────────────────────────────────────────"
ssh $SSH_OPTS $VPS "psql -h localhost -U cortexbuild -d cortexbuild -c \"SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'oauth_providers') as oauth_table_exists;\"" 2>/dev/null || echo "   Error checking migrations"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Report generated: $(date)"
echo "═══════════════════════════════════════════════════════════"
