# Deploy CortexBuild Pro to iOS (TestFlight)

End-to-end build + submit for the Expo iOS app. Run from a Mac with Xcode + EAS CLI.

## Prerequisites (one-time)
- Apple Developer account: **Adrian Stanca (Individual)**, team `4G3G5MX9BH`
- EAS CLI: `npm install -g eas-cli` (or use repo-pinned `eas-cli@21.0.1`)
- Authenticate: `eas login` (account `adrianstanca1`)
- `eas device:create` not needed for production/TestFlight (internal distribution only)

## Project identity (verified)
| Field | Value |
|-------|-------|
| Expo owner | `adrianstanca` |
| Slug | `cortexbuild-pro` |
| Bundle ID | `com.cortexbuild.app` |
| EAS projectId | `3b86383b-6d52-4ec4-afae-c8583b49f3d6` |
| API endpoint | `https://cortexbuildpro.com` |
| Submit Apple ID | `Adrian.stanca1@icloud.com` |

## Credentials status (as of 2026-07-16)
- Distribution cert: serial `0`, expires **2027-06-03**, team `4G3G5MX9BH` ✅
- Provisioning profile `43UY65JXM2`: **active**, expires **2027-06-03** ✅
- These are already registered in EAS for `com.cortexbuild.app`. No renewal needed until 2027.

## Build (production IPA)
```bash
cd cortexx-review/expo
npx eas build --platform ios --profile production
```
- `autoIncrement: true` bumps build number each run (no manual bump).
- Cloud build on EAS (no Mac needed for compilation). ~15–25 min.

## Submit to TestFlight
```bash
npx eas submit --platform ios --profile production
```
- Uses `eas.json` → `submit.production.ios.appleId`.
- Walks through asc-auth; uploads IPA to App Store Connect → TestFlight.
- After processing, add internal testers in App Store Connect.

## Verify before building (local typecheck)
```bash
cd cortexx-review/expo
npx tsc --noEmit   # must exit 0
```
Last verified: **2026-07-16 — tsc --noEmit exit 0, no errors.**

## Gotchas
- Do NOT build `@adrianstanca1/root` / `com.adrianstanca1.root` — that is a placeholder
  project, NOT CortexBuild. Always confirm `bundleIdentifier: com.cortexbuild.app` in app.json.
- `dist/`, `node_modules/`, `*.p8`, `*.p12`, `*.mobileprovision` are gitignored — never commit certs.
- `eas.json` pins `cli.version: 21.0.1` for reproducible builds. Don't bump casually.
- App Store Connect requires `ITSAppUsesNonExemptEncryption: false` (set in app.json infoPlist) — already done.

## Rollback
EAS keeps build history; redeploy a prior build number from App Store Connect if a release regresses.
