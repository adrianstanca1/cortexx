#!/usr/bin/env bash
# Cortexx iOS — build + submit to TestFlight / App Store Connect
# Run on a Mac (or any machine with eas-cli + your Apple 2FA device nearby)
# Prereq: export EXPO_TOKEN=...   (expo.dev → Settings → Access Tokens)
set -euo pipefail
cd "$(dirname "$0")"

if [ -z "${EXPO_TOKEN:-}" ]; then
  echo "ERROR: set EXPO_TOKEN first  (expo.dev → Settings → Access Tokens)"
  echo "       then re-run:  bash build-and-submit-ios.sh"
  exit 1
fi

echo "==> Step 1/2: cloud build (production iOS)"
echo "    When prompted, connect your Apple account and APPROVE 2FA on your device."
npx eas build --profile production --platform ios

echo "==> Step 2/2: submit to TestFlight / App Store Connect"
npx eas submit --platform ios --profile production
echo "    -> build uploaded to App Store Connect; appears in TestFlight."

echo ""
echo "DONE (TestFlight). For PUBLIC App Store release, finish in App Store Connect:"
echo "  1. Select this build, add description/screenshots/age-rating"
echo "  2. Submit for Review (portal-only step — no CLI does this)"
echo ""
echo "SECURITY: rotate EXPO_TOKEN at expo.dev after use (it was exposed in chat)."
