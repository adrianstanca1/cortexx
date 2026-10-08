# Cortexx — iOS / Expo / TestFlight release

## Canonical application identities (8 October 2026)

| Service | Canonical Cortexx record |
| --- | --- |
| GitHub | `adrianstanca1/cortexx` |
| Expo / EAS | [`@adrianstanca/cortexx`](https://expo.dev/accounts/adrianstanca/projects/cortexx) |
| Expo project UUID | `76a768f6-ab7d-4c25-b71d-4b978a32ef61` |
| iPhone app name | `Cortex Construct` |
| Apple bundle identifier | `com.cortexbuild.app` |
| App Store Connect app ID | `6820322670` |
| Apple Developer team | `4G3G5MX9BH` |
| Backend | `https://cortexbuildpro.tech` |

**Do not change the bundle identifier or the existing App Store Connect app ID.** Retaining those values keeps current TestFlight testers and Apple's build history under one application.

The legacy EAS project `@adrianstanca/cortexbuild-pro` (UUID `3b86383b-6d52-4ec4-afae-c8583b49f3d6`) holds historical production builds including 18 and 19. This is **not** the Expo project used by new Cortexx source builds. Existing Expo build records and remotely managed credentials are project-specific and are not automatically transferred to the new project.

## Build from Cortexx

The GitHub workflow `.github/workflows/eas-testflight.yml` runs the release with GitHub-managed `EXPO_TOKEN` and Apple Team API key secrets:

1. Verify `expo/app.json` has slug `cortexx` and EAS project UUID `76a768f6-ab7d-4c25-b71d-4b978a32ef61`.
2. Verify iOS signing credentials are configured **for the new EAS project**, not merely for the legacy project.
3. Run the EAS production build (remote iOS build-number auto-increment):
   ```sh
   cd expo
   npx eas-cli@24.11.0 build --platform ios --profile production --non-interactive --wait --json
   ```
4. Submit the finished signed IPA to the **existing** App Store Connect app, ID `6820322670`, and confirm Apple processing and internal TestFlight distribution.

Because signing credentials are isolated by EAS project, a successful legacy EAS build does **not** prove a new-project production build can sign. If signing preflight requests setup, provision or securely import an Apple Distribution certificate and provisioning profile into the Cortexx project without deleting or revoking the credentials for the legacy app.

The direct-Apple-upload fallback uses a completed signed IPA and Apple Team API key in an ephemeral macOS GitHub runner. Do not commit `.p8` files, P12 certificates, provisioning profiles or IPA download URLs; remove temporary artifact URL secrets after uploads.

## Validation

```sh
cd expo
npx eas-cli@24.11.0 project:info
npx tsc --noEmit
```

The project info must show `@adrianstanca/cortexx`. Apple TestFlight must report the newly uploaded build as `VALID`, associated with an internal beta group and `IN_BETA_TESTING` before considering the release complete.

Older build links under `@adrianstanca/cortexbuild-pro` remain valid for historical reference; they are not evidence that the new Expo project contains those builds.
