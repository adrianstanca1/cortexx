# Cortexx iOS CI and TestFlight releases

Cortexx has **two separate iOS applications and build paths**. Do not assume an Expo build and a Capacitor native build are interchangeable.

| Workflow | Application | Build runner | Apple signing |
| --- | --- | --- | --- |
| `.github/workflows/eas-testflight.yml` | Expo / React Native in `expo/` | EAS cloud macOS build workers; GitHub runners for submission | Expo-managed distribution certificate and profile |
| `.github/workflows/ios-build.yml` | Capacitor shell in `ios/` | GitHub-hosted macOS | Unsigned verification on pushes; optional manual native distribution signing |
| `.github/workflows/release-ios.yml` | Capacitor shell in `ios/` | GitHub-hosted macOS | Manual Apple Distribution certificate and matching App Store provisioning profile required |

Both applications use the `com.cortexbuild.app` bundle identifier. The production App Store Connect app ID is `6820322670`. Only one build may be uploaded for a given bundle identifier and build number.

## Verified TestFlight path

On 8 October 2026, Expo iOS release **1.0.0 (15)** (EAS build ID `11704305-db82-4ff0-95ae-fe67861c41e6`) was uploaded to Apple using `xcrun altool` from a temporary macOS GitHub Actions runner. Apple's API subsequently reported build 15 as `VALID`, assigned to the `Team (Expo)` internal group and `IN_BETA_TESTING`.

To inspect the current release, open `.github/workflows/eas-testflight.yml` with `workflow_dispatch` and choose `upload_method: status`; optionally supply `apple_build_number`. The status job fails unless the selected build is valid, assigned to internal testers, and actively in beta testing. It uses the App Store Connect Team API key stored in GitHub Secrets, without printing the private key.

The EAS workflow supports `expo`, `direct`, and `status` modes. The direct mode uploads a **previously signed EAS IPA** from a temporary protected artifact URL (`CORTEXX_SIGNED_IPA_URL` GitHub secret), validates that the IPA contains bundle ID `com.cortexbuild.app`, and uses Apple's Transporter via `xcrun altool`. **The artifact URL is temporary and must be removed after use.** Direct mode is not yet an unattended build-and-upload flow, because the GitHub runner cannot reliably fetch the old build URL through `eas build:view`. The standard EAS submit mode may also fail within Expo before upload; check the submission run rather than treating a successful EAS build as delivery.

EAS builds may be **started on Linux**, because compilation and signing occur on Expo's remote macOS infrastructure. Local Xcode archives, however, require a macOS runner.

## Native Capacitor verification and release

On pushes to `main`, `ios-build.yml` builds the web assets, synchronizes Capacitor, installs CocoaPods, and verifies **unsigned** iOS build and archive outputs. It must not import certificates, provision profiles, export a signed IPA, or upload to Apple on ordinary pushes.

For a **native Capacitor signed IPA**, explicitly dispatch a release with signing enabled. The native release preflight sets `IOS_REQUIRE_NATIVE_DISTRIBUTION=true` and requires the following GitHub secrets:

- `IOS_CERTIFICATE_BASE64`: Apple Distribution `.p12` containing the certificate **and private key**.
- `IOS_CERTIFICATE_PASSWORD`, `IOS_KEYCHAIN_PASSWORD`: the P12 and temporary keychain passwords.
- `IOS_PROVISIONING_PROFILE_BASE64`: an App Store distribution provisioning profile for `com.cortexbuild.app`.
- `APPLE_TEAM_ID`: Apple Developer team identifier.
- For TestFlight upload, also provide `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`, and `APP_STORE_CONNECT_KEY_BASE64`.

**An App Store Connect API key is not a replacement for a distribution certificate and its private key on an ephemeral GitHub macOS runner.** If the manual signing secrets are missing, the release stops at preflight before contacting Xcode's certificate management system. Do not revoke existing Apple Development or Distribution certificates to fix a CI signing conflict.

When manual credentials are available, `scripts/configure-ios-manual-signing.rb` configures **only the App Release target** with the Apple Distribution identity, team, and provisioning profile. It does not impose signing overrides globally on CocoaPods targets. The workflow checks the Ruby script syntax on macOS.

Native iOS failures save the Xcode diagnostic output as an Actions artifact, without persisting the private P12 or `.p8` key. Xcode's signing identity and provisioning profile must be verified on the signing runner before any real native release can be declared successful.

## Distribution and security checks

- A successful unsigned build is **not** a deployable IPA.
- A successful EAS build is **not** an Apple upload.
- A successful upload must still finish Apple processing and internal TestFlight assignment.
- Never commit Apple API private keys, P12 archives, provisioning profiles, tokens, or signed artifact download URLs to source control.
- Additional capabilities such as Associated Domains / AASA and StoreKit should be verified separately for App Store publication. They are not grounds to revoke a working TestFlight signing certificate.

See `test/ios-signing-preflight.test.js` and `test/eas-testflight-workflow.test.js` for regression coverage.
