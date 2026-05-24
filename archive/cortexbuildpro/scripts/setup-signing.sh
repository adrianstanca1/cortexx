#!/usr/bin/env bash
#
# Set up code signing for App Store distribution.
#
# Reads (from GitHub Actions secrets, exposed as env vars):
#   IOS_DISTRIBUTION_P12       — base64-encoded P12 (cert + private key)
#   IOS_P12_PASSWORD           — password for the P12 archive
#   IOS_PROVISIONING_PROFILE   — base64-encoded .mobileprovision
#
# Writes to $GITHUB_ENV (consumed by downstream workflow steps):
#   KEYCHAIN_PATH     — temp keychain holding the imported cert (for cleanup)
#   PROFILE_UUID      — UUID of the installed provisioning profile
#   PROFILE_NAME      — human-readable name (for ExportOptions.plist)
#   PROFILE_BUNDLE_ID — bundle ID the profile covers (sanity check vs app.json)
#   SIGNING_IDENTITY  — full Common Name of the codesigning identity, e.g.
#                       "Apple Distribution: Adrian Stanca (4G3G5MX9BH)"
#
# Auto-detection of NAME / UUID / IDENTITY means we don't hard-code values
# that depend on which specific profile and cert Adrian uploaded. Re-issuing
# a profile (e.g. when the team adds a capability) doesn't break this script
# — push the new profile to secrets and rerun.

set -euo pipefail

for v in IOS_DISTRIBUTION_P12 IOS_P12_PASSWORD IOS_PROVISIONING_PROFILE; do
  if [ -z "${!v:-}" ]; then
    echo "::error::Required secret $v is empty or missing"
    exit 1
  fi
done

KEYCHAIN_PATH="$RUNNER_TEMP/cortexbuildpro.keychain-db"
KEYCHAIN_PASS=$(uuidgen)

# ── Keychain: create + add to search list ───────────────────────────
security create-keychain -p "$KEYCHAIN_PASS" "$KEYCHAIN_PATH"
security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"   # 6h auto-lock
security unlock-keychain -p "$KEYCHAIN_PASS" "$KEYCHAIN_PATH"
existing=$(security list-keychains -d user | tr -d '"' | xargs)
security list-keychains -d user -s "$KEYCHAIN_PATH" $existing

# ── Cert: decode P12 + import to keychain ───────────────────────────
P12_PATH="$RUNNER_TEMP/cert.p12"
printf '%s' "$IOS_DISTRIBUTION_P12" | base64 --decode > "$P12_PATH"
if ! security import "$P12_PATH" \
  -k "$KEYCHAIN_PATH" \
  -P "$IOS_P12_PASSWORD" \
  -T /usr/bin/codesign \
  -T /usr/bin/security \
  -T /usr/bin/xcodebuild 2>&1; then
  echo "::error::P12 import failed — IOS_P12_PASSWORD does not match the IOS_DISTRIBUTION_P12 archive."
  echo "::error::Re-upload one or the other:"
  echo "::error::  gh secret set IOS_DISTRIBUTION_P12 -R adrianstanca1/cortexbuildpro < /path/to/your.p12"
  echo "::error::  gh secret set IOS_P12_PASSWORD -R adrianstanca1/cortexbuildpro"
  exit 1
fi

# Allow codesign to use the key without UI prompt
security set-key-partition-list \
  -S apple-tool:,apple:,codesign: \
  -s -k "$KEYCHAIN_PASS" "$KEYCHAIN_PATH"

# ── Discover signing identity from the imported cert ────────────────
SIGNING_IDENTITY=$(security find-identity -v -p codesigning "$KEYCHAIN_PATH" \
  | grep -oE '"[^"]+"' | head -1 | tr -d '"')
if [ -z "$SIGNING_IDENTITY" ]; then
  echo "::error::Failed to discover codesigning identity from imported P12"
  security find-identity -v -p codesigning "$KEYCHAIN_PATH" || true
  exit 1
fi

# ── Provisioning profile: decode, inspect, install ──────────────────
PROFILE_TMP="$RUNNER_TEMP/profile.mobileprovision"
PROFILE_PLIST="$RUNNER_TEMP/profile.plist"
printf '%s' "$IOS_PROVISIONING_PROFILE" | base64 --decode > "$PROFILE_TMP"

# .mobileprovision is CMS-wrapped XML plist; security cms -D unwraps it
security cms -D -i "$PROFILE_TMP" -o "$PROFILE_PLIST"

PROFILE_UUID=$(/usr/libexec/PlistBuddy -c "Print :UUID" "$PROFILE_PLIST")
PROFILE_NAME=$(/usr/libexec/PlistBuddy -c "Print :Name" "$PROFILE_PLIST")
PROFILE_APP_ID=$(/usr/libexec/PlistBuddy -c "Print :Entitlements:application-identifier" "$PROFILE_PLIST")
PROFILE_BUNDLE_ID="${PROFILE_APP_ID#*.}"   # strip TEAMID. prefix → bundle ID

# Install profile where Xcode looks for it
PROFILE_DIR="$HOME/Library/MobileDevice/Provisioning Profiles"
mkdir -p "$PROFILE_DIR"
cp "$PROFILE_TMP" "$PROFILE_DIR/$PROFILE_UUID.mobileprovision"

# ── Export to downstream steps ──────────────────────────────────────
{
  echo "KEYCHAIN_PATH=$KEYCHAIN_PATH"
  echo "PROFILE_UUID=$PROFILE_UUID"
  echo "PROFILE_NAME=$PROFILE_NAME"
  echo "PROFILE_BUNDLE_ID=$PROFILE_BUNDLE_ID"
  echo "SIGNING_IDENTITY=$SIGNING_IDENTITY"
} >> "$GITHUB_ENV"

echo ""
echo "Signing setup complete:"
echo "  Profile:   $PROFILE_NAME"
echo "  UUID:      $PROFILE_UUID"
echo "  Bundle ID: $PROFILE_BUNDLE_ID"
echo "  Identity:  $SIGNING_IDENTITY"
echo "  Keychain:  $KEYCHAIN_PATH"
