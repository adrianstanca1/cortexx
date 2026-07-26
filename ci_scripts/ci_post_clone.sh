#!/bin/bash
# Xcode Cloud — runs automatically AFTER the repo is cloned and BEFORE the
# first build. Without this:
#   1. `ios/App/Pods/` is never installed (it is gitignored), so App.xcodeproj
#      cannot find its base configuration
#      `Pods/Target Support Files/Pods-App/Pods-App.release.xcconfig` and the
#      build fails with: "Unable to open base configuration reference file …".
#   2. `ios/www/` (the web bundle Capacitor wraps) is gitignored and only
#      produced by `npm run build:web`; if it is missing/stale, archive fails
#      because the native target has no synced web assets.
#
# Fix: install JS deps -> build web assets -> `cap sync ios` (generates the
# CocoaPods workspace + copies www/ into the native project) -> `pod install`.
set -euo pipefail

WS="${CI_WORKSPACE:-$(pwd)}"
echo "→ [ci_post_clone] workspace: $WS"

cd "$WS"

# 1) JS dependencies — required so the Capacitor Podfile can find
#    ../node_modules/@capacitor/ios etc.
if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund || npm install --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

# 2) Build the web bundle (Cortexx.html -> ios/www/index.html) so the
#    native project has assets to wrap. Runs from the ios/ folder.
if [ -f ios/package.json ]; then
  ( cd ios && npm install --no-audit --no-fund )
  ( cd ios && npm run build:web )
fi

# 3) Sync Capacitor (copies www/ into ios/App and updates native config).
if [ -x node_modules/.bin/cap ]; then
  npx cap sync ios
fi

# 4) CocoaPods — generates Pods-App.*.xcconfig + Pods.xcworkspace.
cd "$WS/ios/App"
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

echo "→ [ci_post_clone] CocoaPods installed — ios/App ready to build"
