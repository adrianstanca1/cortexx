#!/usr/bin/env bash
# scripts/prep-ios.sh — one-shot prep before App Store deploy
# Usage: ./scripts/prep-ios.sh

set -euo pipefail

echo "==> [1/5] Installing Node dependencies..."
npm ci --legacy-peer-deps

echo "==> [2/5] Running tests..."
npm test -- --reporter=dot 2>&1 | tail -3

echo "==> [3/5] Building web bundle..."
NODE_ENV=production npm run build

echo "==> [4/5] Syncing Capacitor iOS..."
npx cap sync ios

echo "==> [5/5] Verifying iOS project..."
[ -d "ios/App/App.xcodeproj" ] && echo "  ✓ Xcode project exists"
[ -f "ios/App/App/Info.plist" ] && echo "  ✓ Info.plist exists"
[ -f "ios/App/App/App.entitlements" ] && echo "  ✓ Entitlements exist"
[ -f "ios/App/ExportOptions.plist" ] && echo "  ✓ ExportOptions exists"
[ -d "ios/App/App/Assets.xcassets/AppIcon.appiconset" ] && echo "  ✓ App icon catalog exists"
[ -f "ios/App/fastlane/Fastfile" ] && echo "  ✓ Fastfile exists"
[ -f "codemagic.yaml" ] && echo "  ✓ codemagic.yaml exists"
[ -f "patches/@capacitor+push-notifications+8.0.3.patch" ] && echo "  ✓ push-notifications patch exists"

echo ""
echo "==> Ready to ship!"
echo ""
echo "Next steps:"
echo "  Path 1 (free, 7-day):  open ios/App/App.xcodeproj  → Xcode → Run on iPhone"
echo "  Path 2 (TestFlight):   git push origin main         → Codemagic auto-builds"
echo ""
echo "  See docs/INSTALL-ON-IPHONE.md for details."
