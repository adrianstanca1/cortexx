#!/bin/bash
set -euo pipefail

# CortexBuild Ultimate - VPS Code Sync Script
# Syncs git commits from local to production VPS

check_cortex_health_contract() {
    local payload="$1"
    [ -n "$payload" ] || return 1
    python3 -c "import json,sys; d=json.loads(sys.argv[1]); c=d.get('checks') or {}; assert d.get('status') == 'ok'; assert c.get('postgres') is True; assert c.get('redis') is True" "$payload" >/dev/null 2>&1
}

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly VPS_HOST="${VPS_HOST:-root@72.62.132.43}"
readonly VPS_PATH="${VPS_PATH:-/root/cortexbuild-ultimate}"
if [[ -z "${SSH_KEY:-}" ]]; then
    if [[ -f "$HOME/.ssh/gh_actions_ed25519" ]]; then
        SSH_KEY="$HOME/.ssh/gh_actions_ed25519"
    else
        SSH_KEY="$HOME/.ssh/id_ed25519_vps"
    fi
fi
readonly SSH_KEY
readonly SSH_OPTS="-o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes -i $SSH_KEY"

echo "🔄 CortexBuild Ultimate - VPS Code Sync"
echo "========================================"
echo "Project: $PROJECT_ROOT"
echo "Target VPS: $VPS_HOST"
echo "Remote Path: $VPS_PATH"
echo

# Preflight checks
echo "🔍 Preflight Checks..."

# Check SSH key exists
if [[ ! -f "$SSH_KEY" ]]; then
    echo "❌ SSH key not found: $SSH_KEY"
    echo "   Generate one: ssh-keygen -t ed25519 -f $SSH_KEY -C 'cortexbuild-deploy'"
    exit 1
fi

# Check SSH connection
if ! ssh $SSH_OPTS "$VPS_HOST" "echo 'SSH OK'" >/dev/null 2>&1; then
    echo "❌ Cannot connect to VPS via SSH"
    echo "   Run: ssh-add $SSH_KEY"
    exit 1
fi

echo "✅ SSH connection verified"
echo

cd "$PROJECT_ROOT"

# Get local and remote commit info
echo "📊 Comparing commits..."
LOCAL_HEAD=$(git rev-parse HEAD)
LOCAL_SHORT=$(git rev-parse --short HEAD)
LOCAL_MSG=$(git log -1 --format=%s HEAD)

VPS_INFO=$(ssh $SSH_OPTS "$VPS_HOST" "cd $VPS_PATH && git rev-parse HEAD 2>/dev/null || echo 'NOT_GIT_REPO'")
VPS_HEAD="${VPS_INFO%% *}"

if [[ "$VPS_HEAD" == "NOT_GIT_REPO" ]]; then
    echo "❌ VPS directory is not a git repository"
    echo "   Run full deployment instead: ./deploy/vps-sync.sh"
    exit 1
fi

VPS_SHORT=$(ssh $SSH_OPTS "$VPS_HOST" "cd $VPS_PATH && git rev-parse --short HEAD")
VPS_MSG=$(ssh $SSH_OPTS "$VPS_HOST" "cd $VPS_PATH && git log -1 --format=%s HEAD")

echo ""
echo "Local: $LOCAL_SHORT - $LOCAL_MSG"
echo "VPS:   $VPS_SHORT - $VPS_MSG"
echo

# Check if sync needed
if [[ "$LOCAL_HEAD" == "$VPS_HEAD" ]]; then
    echo "✅ VPS is up to date with local"
    exit 0
fi

# Check if VPS is behind
if git merge-base --is-ancestor "$VPS_HEAD" "$LOCAL_HEAD"; then
    echo "✅ VPS is behind local - sync possible"
else
    echo "⚠️  Divergent histories detected"
    echo "   VPS has commits not present locally"
    echo "   Run: ssh $SSH_OPTS $VPS_HOST 'cd $VPS_PATH && git fetch && git status'"
    exit 1
fi

# Get list of commits to sync
echo ""
echo "📋 Commits to sync:"
git log --oneline "$VPS_HEAD".."$LOCAL_HEAD" | while read -r line; do
    echo "   + $line"
done
echo

# Confirm sync
read -p "🚀 Proceed with sync? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Sync cancelled"
    exit 0
fi

# Create backup
echo "💾 Creating backup..."
BACKUP_PATH="/var/backups/cortexbuild-code-$(date +%Y%m%d_%H%M%S)"
ssh $SSH_OPTS "$VPS_HOST" "
    cd $VPS_PATH
    if [ -d .git ]; then
        mkdir -p $(dirname '$BACKUP_PATH')
        tar -czf '$BACKUP_PATH.tar.gz' --exclude='node_modules' --exclude='dist' --exclude='.next' .
        echo 'Backup created: $BACKUP_PATH.tar.gz'
    fi
"

# Sync via git push/fetch
echo "📤 Syncing code to VPS..."

# Create bare repo for pushing
TEMP_BARE="/tmp/cortexbuild-bare-$(date +%s)"
git clone --bare "$PROJECT_ROOT" "$TEMP_BARE"

# Push to VPS
cd "$TEMP_BARE"
ssh $SSH_OPTS "$VPS_HOST" "
    cd $VPS_PATH
    git fetch $PROJECT_ROOT HEAD:refs/heads/main
    git checkout -f main
    git reset --hard HEAD
    
    # Clean up old files
    git clean -fd
    
    echo '✅ Code synced successfully'
"

# Cleanup temp bare repo
rm -rf "$TEMP_BARE"

# Reinstall dependencies if package.json changed
echo ""
echo "📦 Checking dependencies..."
DEPS_CHANGED=$(ssh $SSH_OPTS "$VPS_HOST" "
    cd $VPS_PATH
    if git diff --name-only $VPS_HEAD $LOCAL_HEAD | grep -q 'package.json'; then
        echo 'CHANGED'
    fi
")

if [[ "$DEPS_CHANGED" == "CHANGED" ]]; then
    echo "📦 package.json changed - reinstalling dependencies..."
    ssh $SSH_OPTS "$VPS_HOST" "
        cd $VPS_PATH
        npm ci --production
        cd server && npm ci --production
    "
else
    echo "✅ Dependencies unchanged"
fi

# Rebuild if source files changed
echo ""
echo "🏗️ Rebuilding production assets..."
ssh $SSH_OPTS "$VPS_HOST" "
    cd $VPS_PATH
    npm run build
"

# Restart services
echo ""
echo "🔄 Restarting services..."
ssh $SSH_OPTS "$VPS_HOST" "
    cd $VPS_PATH
    docker restart cortexbuild-api 2>/dev/null || true
    nginx -t >/dev/null 2>&1 && (systemctl reload nginx || service nginx reload || nginx -s reload)
"

# Health check
echo ""
echo "🏥 Running health checks..."
HEALTH_RESULT=$(ssh $SSH_OPTS "$VPS_HOST" "curl --connect-timeout 2 --max-time 5 -fsS http://localhost:3001/api/health" 2>/dev/null || true)

if check_cortex_health_contract "$HEALTH_RESULT"; then
    echo "✅ API health contract verified"
else
    echo "❌ API health contract failed"
    echo "   Payload: ${HEALTH_RESULT:-<empty>}"
    echo "   Check logs: ssh $SSH_OPTS $VPS_HOST 'docker logs --tail 80 cortexbuild-api'"
    exit 1
fi

SITE_CHECK=$(ssh $SSH_OPTS "$VPS_HOST" "curl -sf -o /dev/null -w '%{http_code}' https://www.cortexbuildpro.com/ || echo 'FAILED'")
if [[ "$SITE_CHECK" == "200" ]]; then
    echo "✅ Site health: HTTP $SITE_CHECK"
else
    echo "❌ Site health check failed (HTTP $SITE_CHECK)"
    exit 1
fi

echo ""
echo "🎉 Sync Complete!"
echo "================="
echo "✅ Code synced: $VPS_SHORT → $LOCAL_SHORT"
echo "✅ Services restarted"
echo ""
echo "🔗 Production URLs:"
echo "   - Main site: https://www.cortexbuildpro.com"
echo "   - API health: https://www.cortexbuildpro.com/api/health"
echo ""
echo "🛠️ Rollback if needed:"
echo "   ssh $SSH_OPTS $VPS_HOST 'cd $VPS_PATH && git reset --hard $VPS_HEAD && git clean -fd'"
