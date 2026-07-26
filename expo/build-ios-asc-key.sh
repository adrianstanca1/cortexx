#!/usr/bin/env bash
# Cortexx iOS — non-interactive build + TestFlight submit via App Store Connect API key.
# No device 2FA required. All secrets are consumed in-process and purged after run.
# The caller (Hermes) exports the env vars below BEFORE invoking this script:
#   EXPO_TOKEN                 (expo.dev Access Token)
#   EXPO_APPLE_API_KEY_ID      (e.g. ABCDEFGHIJ)
#   EXPO_APPLE_API_ISSUER_ID   (UUID from App Store Connect Keys page)
#   EXPO_APPLE_API_KEY_PATH    (absolute path to the .p8 file, chmod 600, deleted after)
set -euo pipefail
cd "$(dirname "$0")"

: "${EXPO_TOKEN:?set EXPO_TOKEN}"
: "${EXPO_APPLE_API_KEY_ID:?set EXPO_APPLE_API_KEY_ID}"
: "${EXPO_APPLE_API_ISSUER_ID:?set EXPO_APPLE_API_ISSUER_ID}"
: "${EXPO_APPLE_API_KEY_PATH:?set EXPO_APPLE_API_KEY_PATH}"

echo "==> Non-interactive iOS build (App Store Connect API key)"
npx eas build --profile production --platform ios --non-interactive

echo "==> Non-interactive submit to TestFlight"
npx eas submit --platform ios --profile production --non-interactive

echo "==> Build delivered to App Store Connect / TestFlight."
echo "    Final PUBLIC App Store 'Submit for Review' is portal-only (Apple)."
echo "==> Purging temp .p8"
rm -f "$EXPO_APPLE_API_KEY_PATH"
