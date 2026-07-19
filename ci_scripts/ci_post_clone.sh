#!/bin/bash
# Xcode Cloud — runs automatically AFTER the repo is cloned and BEFORE the
# first build. Without this, `ios/App/Pods/` is never installed (it is
# gitignored), so `App.xcodeproj` cannot find its base configuration
# `Pods/Target Support Files/Pods-App/Pods-App.release.xcconfig` and the
# build fails with:
#   "Unable to open base configuration reference file
#    '.../ios/App/Pods/Target Support Files/Pods-App/Pods-App.release.xcconfig'"
#
# Fix: install JS deps (Capacitor pods resolve from ../node_modules) then
# `pod install`, which generates that xcconfig + the whole Pods workspace.
set -euo pipefail

WS="${CI_WORKSPACE:-$(pwd)}"
echo "→ [ci_post_clone] workspace: $WS"

# 1) JS dependencies — required so the Capacitor Podfile can find
#    ../node_modules/@capacitor/ios etc.
cd "$WS"
if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund || npm install --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

# 2) CocoaPods — generates Pods-App.*.xcconfig + Pods.xcworkspace.
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
