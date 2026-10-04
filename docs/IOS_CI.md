# iOS CI & Release Pipeline

## Why iOS builds cannot run on this Linux VPS

Cortexx ships a Capacitor 8 iOS shell (`ios/`, bundle id `com.cortexbuild.app`).
Every iOS distribution step requires an **interactive macOS environment with the
Apple toolchain** — it cannot be performed headlessly from this Linux VPS:

- **Apple Distribution certificate + private key** — must live in a macOS
  Keychain; there is no Linux equivalent for code-signing an `.ipa`.
- **Provisioning profile** — issued by the Apple Developer portal against a
  specific cert + device UDIDs; managed by Xcode/`fastlane` on macOS.
- **EAS Build (`eas build`)** — Expo Application Services sign and archive the
  app on a macOS builder; the `ios:*` + `eas build` steps need macOS runners.
- **AASA universal links** — `apple-app-site-association` must be hosted at the
  apex/`.well-known` of `cortexbuildpro.tech`; validates App Clip / universal-link
  handoff and is an App Store submission requirement.
- **StoreKit IAP plugin** — in-app purchases require the StoreKit configuration
  and a signed capability; reviewed at submission time by App Store Connect.
- **TestFlight + App Store submission** — `xcrun altool` / Transporter and the
  App Store Connect API calls are macOS-only and expect Xcode present.

## Recommendation

Run the iOS-specific stages on a **macOS GitHub Actions self-hosted runner**
(running macOS with Xcode + the Apple dist cert in its Keychain), while the
Linux VPS continues to own web/API builds and tests.

Wire the split in CI:

```yaml
ios-build:
  runs-on: [self-hosted, macos]   # NOT ubuntu-latest
  steps:
    - run: npm run ios:sync        # cap copy && cap sync ios
    - run: npx eas build --platform ios --non-interactive
    - run: npx eas submit --platform ios --non-interactive   # TestFlight / App Store
```

Keep `node build-dist.js` (the SPA precompile) and `npm test` on the Linux
runner. The self-hosted macOS runner only needs to handle `ios:*` and
`eas build`/`eas submit`.

## Current blockers (must be resolved on the Mac before first submission)

- Provisioning profile + distribution cert provisioned in the macOS Keychain.
- AASA file served from `cortexbuildpro.tech/.well-known/apple-app-site-association`.
- StoreKit IAP capability enabled and the product registered in App Store Connect.
- `eas.json` iOS credentials attached to the `com.cortexbuild.app` bundle id.

See `CLAUDE.md` (iOS section) for the canonical bundle id and Capacitor config.

## Signing preflight and delivery status

Both GitHub Actions workflows run `scripts/check-ios-signing.mjs` before
installing dependencies. Automatic `ios-build.yml` pushes may verify an unsigned
build when signing is unavailable; that success does not deliver an IPA or upload
to TestFlight. A manual request with `upload_to_testflight: true` requires all
signing and App Store Connect secrets and fails early if any are missing.

`release-ios.yml` always requires signing for its archive. Tag releases also
require upload credentials; a manual archive-only request may omit them. A
configured secret establishes availability, while the subsequent certificate
import, profile installation, archive and upload steps establish validity.

Archive secrets: `IOS_CERTIFICATE_BASE64`, `IOS_CERTIFICATE_PASSWORD`,
`IOS_KEYCHAIN_PASSWORD`, `IOS_PROVISIONING_PROFILE_BASE64`, `APPLE_TEAM_ID`.
Upload secrets: `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`,
`APP_STORE_CONNECT_KEY_BASE64`. Diagnostics print missing names only.

The export step must produce exactly one non-empty IPA. Its actual path is used
for upload and artifact retention, so delivery does not depend on the Xcode
product being named `Cortexx`. Archive/export pipeline failures propagate even
when their output is piped through a formatter.
