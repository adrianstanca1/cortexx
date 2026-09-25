#!/bin/bash
# Xcode Cloud post-clone bootstrap.
#
# Xcode Cloud executes this script from ci_scripts/, not necessarily from the
# repository root. Use Apple's documented CI_PRIMARY_REPOSITORY_PATH and fall
# back to the script's parent directory for local/manual verification.
#
# The native wrapper has an intentionally independent Capacitor 6 toolchain in
# ios/. Root Cortexx uses Capacitor 8 for the PWA/native shell. Never run the
# root Capacitor CLI against ios/App: sync from ios/ so its package lock,
# capacitor.config.ts and Podfile all resolve the same Capacitor generation.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
IOS_DIR="$REPO_ROOT/ios"
APP_DIR="$IOS_DIR/App"

echo "→ [ci_post_clone] repository: $REPO_ROOT"
echo "→ [ci_post_clone] iOS project: $IOS_DIR"

if [ ! -f "$IOS_DIR/package.json" ] || [ ! -f "$IOS_DIR/package-lock.json" ]; then
  echo "::error::iOS package manifest/lockfile not found under $IOS_DIR"
  exit 1
fi

# Install exactly the iOS-local JS dependency graph, build the offline web
# payload, then sync with that same local Capacitor CLI/configuration.
cd "$IOS_DIR"
npm ci --no-audit --no-fund
npm run build:web
npx cap sync ios

# Capacitor's Podfile resolves ../node_modules from ios/App, i.e. ios/node_modules.
cd "$APP_DIR"
if ! command -v pod >/dev/null 2>&1; then
  echo "  pod not found — installing via gem"
  gem install cocoapods --no-document
fi

if [ -f Gemfile ]; then
  bundle install --local || bundle install
  bundle exec pod install --no-repo-update
else
  pod install --no-repo-update
fi

echo "→ [ci_post_clone] iOS dependencies and Capacitor assets are ready"
