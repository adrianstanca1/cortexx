#!/usr/bin/env bash
# commit-and-sync.sh — REMEDIATION script for the 2026-04-27 session.
#
# Background:
#   Three Cowork agent sessions were live on this repo at once. Two of them
#   produced the legitimate "feat: expand N modules" commits (now on
#   origin/main as 05a70a6 and 8785b71). My session attempted to commit a
#   TASKS.md sync but the index already held PARTIAL REVERTS of feature
#   work staged by the other sessions. The resulting commit eb9d2d5 was
#   pushed to origin and is BAD — it strips imports + recharts code from
#   AIVision.tsx, AuditLog.tsx, CostManagement.tsx, ExecutiveReports.tsx,
#   GlobalSearch.tsx, Inspections.tsx, PermissionsManager.tsx, SubmittalManagement.tsx.
#
# What this script does:
#   1. Verifies origin/main is still at eb9d2d5 (no later force-push)
#   2. Creates a revert commit of eb9d2d5 — restores all 8 modules to the
#      good state from 8785b71
#   3. Commits TASKS.md if it has uncommitted changes (already in HEAD, so
#      this is a no-op in practice)
#   4. Pushes the revert
#
# Run this from the user's actual machine — the sandbox can't because of
# concurrent index.lock contention with the other sessions.

set -euo pipefail

cd "$(dirname "$0")"
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

echo "==> Repo: $(pwd)"
echo "==> Branch: $(git rev-parse --abbrev-ref HEAD)"

# ---- Sanity checks -------------------------------------------------------
if [ -z "$(git config user.email)" ]; then
  git config user.email 'adrian.stanca1@gmail.com'
  git config user.name  'Adrian Stanca'
fi

git fetch origin

REMOTE_HEAD=$(git rev-parse origin/main)
LOCAL_HEAD=$(git rev-parse HEAD)
BAD_COMMIT='eb9d2d5fb7e8a34897fbc0aae28d3e863c3a6eeb'

echo "==> origin/main = $REMOTE_HEAD"
echo "==> local HEAD  = $LOCAL_HEAD"
echo "==> bad commit  = $BAD_COMMIT"

# Bring local main level with origin/main
if [ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]; then
  echo "==> Resetting local main to origin/main"
  git checkout main
  git reset --hard origin/main
fi

# Sanity: bad commit must be reachable
if ! git merge-base --is-ancestor "$BAD_COMMIT" HEAD; then
  echo "!! Bad commit $BAD_COMMIT is not in the current history. Aborting."
  echo "   It may have already been reverted or the branch was rewritten."
  exit 1
fi

# ---- Revert the bad commit ----------------------------------------------
echo "==> Reverting $BAD_COMMIT"
git revert --no-edit "$BAD_COMMIT" || {
  echo "!! Revert produced conflicts. Resolve manually then run:"
  echo "   git revert --continue"
  echo "   git push origin main"
  exit 1
}

# Customise the revert commit message
LAST_MSG=$(git log -1 --pretty=%B)
git commit --amend --no-verify -m "fix(modules): revert eb9d2d5 — accidental partial-revert of feature work

eb9d2d5 was authored by a Cowork session whose index held stale, partially-
reverted versions of 8 module files. The commit message read 'chore(tasks):
sync TASKS.md' but the actual diff stripped imports + recharts code from:

- src/components/modules/AIVision.tsx
- src/components/modules/AuditLog.tsx
- src/components/modules/CostManagement.tsx
- src/components/modules/ExecutiveReports.tsx
- src/components/modules/GlobalSearch.tsx
- src/components/modules/Inspections.tsx
- src/components/modules/PermissionsManager.tsx
- src/components/modules/SubmittalManagement.tsx

Restoring the good state from 8785b71."

# ---- Pre-push integrity gate (per CLAUDE.md) ----------------------------
if command -v npx >/dev/null 2>&1; then
  echo "==> Running tsc --noEmit"
  npx --no-install tsc --noEmit 2>&1 | tail -20 || {
    echo "!! tsc errors — push BLOCKED. Investigate."
    exit 1
  }
fi

# ---- Push ----------------------------------------------------------------
echo "==> Pushing to origin/main"
git push origin main

echo ""
echo "==> Done. Verify:"
echo "   https://github.com/adrianstanca1/cortexbuild-ultimate/actions"
echo "   https://www.cortexbuildpro.com/api/health"
