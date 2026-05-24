# App Store Deployment Guide — CortexBuild iOS

This guide takes the iOS app from source → signed IPA → TestFlight → App Store.

## App identity

|                   |                                                        |
| ----------------- | ------------------------------------------------------ |
| Bundle ID         | `com.cortexbuildpro.app`                               |
| Marketing version | `1.0` (set in `ios/App/App.xcodeproj/project.pbxproj`) |
| Build number      | `1` (auto-incremented by `next_build_number` lane)     |
| App name          | CortexBuild                                            |

## One-time setup (do these once)

### 1. Apple Developer Program enrolment

Sign up at https://developer.apple.com/programs/ ($99/year). You need this before anything else.

### 2. Register the app in App Store Connect

1. Go to https://appstoreconnect.apple.com → My Apps → `+` → New App
2. Platform: iOS
3. Name: `CortexBuild`
4. Primary language: English (U.K.)
5. Bundle ID: `com.cortexbuildpro.app` (must match exactly — register it in https://developer.apple.com/account/resources/identifiers/list first)
6. SKU: `cortexbuild-ios`
7. User Access: Full Access

### 3. Generate App Store Connect API key

1. https://appstoreconnect.apple.com/access/api → Keys → Generate API Key
2. Name: `cortexbuild-ci`
3. Access: App Manager
4. Download the `.p8` file (you can only download once — store it safely)
5. Note the **Key ID** (10 chars) and **Issuer ID** (UUID)

### 4. Pick your CI provider

Two options — pick one:

#### Option A: Codemagic (recommended — handles signing automatically)

1. Sign up at https://codemagic.io with GitHub
2. Select `adrianstanca1/cortexbuild-ultimate`
3. Codemagic auto-detects `codemagic.yaml`
4. Settings → Environment variables → add a group called `apple_credentials`:
   - `APP_STORE_CONNECT_API_KEY_KEY_ID` (the 10-char Key ID)
   - `APP_STORE_CONNECT_API_KEY_ISSUER_ID` (the UUID)
   - `APP_STORE_CONNECT_API_KEY_PRIVATE_KEY` (paste the entire `.p8` contents including BEGIN/END lines)
   - `TEAM_ID` (10-char string from https://developer.apple.com/account → Membership)
5. Settings → Code signing identities → Apple Developer Portal → connect via API key
6. Settings → Automatic code signing → Distribution type: `App Store`, Bundle ID: `com.cortexbuildpro.app`

**Trigger first build:**

```bash
git push origin main   # the ios-testflight workflow runs on push to main
```

OR manually:

- Codemagic UI → workflow `ios-testflight` → Start new build

The pipeline will:

1. Install Node deps + build web assets
2. `npx cap sync ios`
3. Resolve Swift packages
4. Pull latest TestFlight build number, increment by 1
5. Archive → Export IPA → Upload to TestFlight

You'll get an email when the build is ready in TestFlight.

#### Option B: GitHub Actions + fastlane (more setup, cheaper)

This is more DIY. The included `.github/workflows/ios-build.yml` only produces unsigned builds — for signed App Store builds, you need to add fastlane match for certificate management.

Add these GitHub repository secrets (Settings → Secrets and variables → Actions):

- `APPLE_TEAM_ID` (10-char team ID)
- `APP_STORE_CONNECT_API_KEY_ID`
- `APP_STORE_CONNECT_API_ISSUER_ID`
- `APP_STORE_CONNECT_API_KEY_BASE64` (the `.p8` file, base64-encoded)
- `MATCH_PASSWORD` (a strong passphrase for fastlane match)
- `MATCH_GIT_URL` (URL of a private repo to store encrypted certs)

Then run locally on a Mac with Xcode (one-time):

```bash
cd ios/App
fastlane match init
fastlane match appstore   # generates + uploads cert to MATCH_GIT_URL
```

Add this step to the iOS Build workflow (after "Sync Capacitor iOS"):

```yaml
- name: Setup signing
  env:
    MATCH_PASSWORD: ${{ secrets.MATCH_PASSWORD }}
    MATCH_GIT_URL: ${{ secrets.MATCH_GIT_URL }}
  run: |
    cd ios/App
    bundle install
    bundle exec fastlane match appstore --readonly

- name: Build + upload
  env:
    APP_STORE_CONNECT_API_KEY_ID: ${{ secrets.APP_STORE_CONNECT_API_KEY_ID }}
    APP_STORE_CONNECT_API_ISSUER_ID: ${{ secrets.APP_STORE_CONNECT_API_ISSUER_ID }}
    APP_STORE_CONNECT_API_KEY_CONTENT: ${{ secrets.APP_STORE_CONNECT_API_KEY_BASE64 }}
  run: |
    cd ios/App
    bundle exec fastlane beta
```

### 5. App Store Connect metadata

Before submission you need to fill in:

- **App icon** (1024×1024) — already in `ios/App/App/Assets.xcassets/AppIcon.appiconset` ✅
- **App description** (max 4000 chars)
- **Keywords** (100 chars total)
- **Screenshots** for 6.7" + 6.1" iPhone (1290×2796 or 1179×2556) and 12.9" iPad (2048×2732) — required for review
- **Support URL** (e.g. https://www.cortexbuildpro.com/support)
- **Marketing URL** (e.g. https://www.cortexbuildpro.com)
- **Privacy policy URL** (mandatory)
- **Age rating** (questionnaire in App Store Connect)
- **Pricing & Availability** (free / paid, countries)
- **App Privacy** (data collection disclosures — must list everything you collect)

## Recurring deploy (after one-time setup)

Every push to `main` automatically triggers a build via Codemagic. The flow is:

```
git push origin main
  ↓
Codemagic builds web + syncs Capacitor
  ↓
Latest TestFlight build number is fetched
  ↓
agvtool bumps CURRENT_PROJECT_VERSION = N+1
  ↓
xcodebuild archive → Export IPA → upload to TestFlight
  ↓
Apple processes (~10–20 min) → email when ready
  ↓
You add internal/external testers in App Store Connect
  ↓
When ready for App Store submission:
  - In App Store Connect → Build → select the TestFlight build
  - Click "Submit for Review"
```

To bump the marketing version (e.g. 1.0 → 1.1):

```bash
cd ios/App
agvtool new-marketing-version 1.1
git commit -am "chore(ios): bump marketing version to 1.1"
git push
```

## Troubleshooting

### "No matching profiles found"

Codemagic auto-managed signing should handle this. If using fastlane match, run `fastlane match appstore --readonly` to fetch the cached profile.

### "Bundle ID not found"

Make sure `com.cortexbuildpro.app` is registered at https://developer.apple.com/account/resources/identifiers/list.

### "Invalid binary"

Usually a missing required Info.plist key or icon. The current `Info.plist` has all permission descriptions; the asset catalog has the 1024×1024 icon. If Apple still complains, the email tells you the exact missing field.

### Build fails at `xcodebuild -resolvePackageDependencies`

Capacitor uses Swift Package Manager — ensure Xcode 16.x. The `codemagic.yaml` pins Xcode 16.2.

### TestFlight build stuck "Processing"

Apple's processing can take 30+ min for the first build (they do extra validation). Subsequent builds are usually <10 min.

## What's already done

- ✅ Capacitor 8 iOS shell at `ios/App/`
- ✅ `App.xcodeproj` with SPM dependencies for all 11 Capacitor plugins
- ✅ `Info.plist` with NSCameraUsageDescription, NSLocationWhenInUseUsageDescription, NSMicrophoneUsageDescription, NSPhotoLibraryUsageDescription/NSPhotoLibraryAddUsageDescription, NSLocationAlwaysAndWhenInUseUsageDescription, UIBackgroundModes (remote-notification)
- ✅ `App.entitlements` with `aps-environment = development`
- ✅ App icon (1024×1024) + splash screen generated by `@capacitor/assets`
- ✅ `ExportOptions.plist` with `__TEAM_ID__` placeholder + Codemagic sed preprocessor
- ✅ `codemagic.yaml` with TestFlight + simulator workflows
- ✅ `fastlane/Appfile` + `Fastfile` with `test` / `build_debug` / `beta` / `release` lanes
- ✅ Native bridges (`src/lib/native/`) for camera, geolocation, haptics, network, push
- ✅ Push notifications: APNs device token registration via `usePushNotifications` hook
- ✅ GPS clock-in geofencing using native Capacitor Geolocation plugin

## What needs YOU

1. ✅ ~~Apple Developer enrolment~~ ← do this
2. ✅ ~~App Store Connect app registration~~ ← do this
3. ✅ ~~Generate API key + add to Codemagic~~ ← do this
4. ✅ ~~Fill in App Store Connect metadata~~ ← do this
5. ✅ ~~Capture screenshots~~ ← do this (Xcode → Device or Simulator → File → Take Screenshot)
6. ✅ ~~Submit for Review~~ ← do this when ready

After step 3, every `git push origin main` ships a new TestFlight build automatically.
