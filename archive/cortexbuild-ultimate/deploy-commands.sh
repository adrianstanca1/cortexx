#!/usr/bin/env bash
# Fast-forward cursor/deploy-scripts-and-build-workflow into main and push,
# triggering the Deploy to VPS workflow.
#
# Run this from the repo root on your own machine (NOT inside the Cowork
# sandbox — the sandbox mount refuses to remove .git/index.lock and has no
# GitHub credentials).

set -euo pipefail

BRANCH="cursor/deploy-scripts-and-build-workflow"

echo "==> Clearing any stale index lock (harmless if absent)"
rm -f .git/index.lock

echo "==> Fetching latest refs"
git fetch origin

echo "==> Checking out ${BRANCH}"
git checkout "${BRANCH}"

echo "==> Switching to main"
git checkout main

echo "==> Fast-forward merging ${BRANCH} into main"
git merge --ff-only "${BRANCH}"

echo "==> Pushing main (triggers .github/workflows/deploy.yml)"
git push origin main

echo "==> Done. Watch the deploy at:"
echo "    https://github.com/adrianstanca1/cortexbuild-ultimate/actions/workflows/deploy.yml"
