#!/bin/bash
set -euo pipefail

REPO_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-$(cd "$(dirname "$0")/.." && pwd)}"
IOS_ROOT="$REPO_ROOT/ios"
PBXPROJ="$IOS_ROOT/App/App.xcodeproj/project.pbxproj"

printf 'Preparing Cortexx iOS build in %s\n' "$IOS_ROOT"
cd "$IOS_ROOT"

node --version
npm --version

# Xcode Cloud starts from a clean checkout. Install the Capacitor toolchain,
# rebuild the bundled web application, and sync native dependencies.
npm install --no-audit --no-fund
npm run build:ios

# Keep the generated Xcode target aligned with the bundle identifier registered
# in App Store Connect. Older generated project files used a stale identifier.
if grep -q 'app\.cortexbuild\.cortexx' "$PBXPROJ"; then
  sed -i '' 's/app\.cortexbuild\.cortexx/com.cortexbuild.app/g' "$PBXPROJ"
fi

grep -q 'PRODUCT_BUNDLE_IDENTIFIER = com.cortexbuild.app;' "$PBXPROJ"

# CocoaPods is not restored automatically by Xcode Cloud for this Capacitor app.
cd "$IOS_ROOT/App"
pod install

printf 'Xcode Cloud preparation completed successfully.\n'
