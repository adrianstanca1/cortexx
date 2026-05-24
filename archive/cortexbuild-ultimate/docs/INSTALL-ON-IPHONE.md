# Install CortexBuild on iPhone

Three paths from "I have the source" to "the app is on my phone", in order of effort.

---

## Path 1 — Free, 7-day install via Xcode (fastest, requires a Mac)

**Requires:** A Mac with Xcode 16.2+, an iPhone, a free Apple ID. **Not** a paid developer account.

```bash
# 1. Pull latest source
cd ~/cortexbuild-ultimate     # or wherever you have it
git pull origin main

# 2. Build the web bundle and sync to iOS
npm install              # picks up the @capacitor/push-notifications patch via postinstall
npm run build
npx cap sync ios

# 3. Open in Xcode
open ios/App/App.xcodeproj
```

Inside Xcode:

1. Connect your iPhone via USB. Trust the computer when prompted.
2. Top bar → device picker → select your iPhone (not a simulator).
3. Click the project in the file tree → target `App` → **Signing & Capabilities** tab.
4. **Team**: select your free Apple ID (add it under Xcode → Settings → Accounts if needed).
5. Bundle Identifier: change `com.cortexbuildpro.app` → `com.yourname.cortexbuild` (free accounts can't register the production bundle ID).
6. Press **▶ Run** (⌘R).

Xcode signs the build with a 7-day provisioning profile and installs it on your phone. After 7 days the app stops launching — re-run from Xcode to refresh it.

**iPhone setup**: first launch will prompt you to trust the developer certificate. Settings → General → VPN & Device Management → trust the certificate.

---

## Path 2 — TestFlight (signed, beta testers, requires paid Apple Developer account)

**Requires:** Apple Developer Program enrolment ($99/yr) and a Codemagic account (free for our usage). **Doesn't** require Xcode locally — Codemagic builds in the cloud.

Follow `docs/APPSTORE-DEPLOY.md` step-by-step. Summary:

1. Enrol at https://developer.apple.com/programs/
2. Register Bundle ID `com.cortexbuildpro.app` at https://developer.apple.com/account/resources/identifiers/list
3. Create the app in App Store Connect: https://appstoreconnect.apple.com → My Apps → New App
4. Generate App Store Connect API Key (Key ID + Issuer ID + .p8 file)
5. Sign up at https://codemagic.io with GitHub, select `adrianstanca1/cortexbuild-ultimate`
6. In Codemagic Settings → Environment variables → group `apple_credentials`, add:
   - `APP_STORE_CONNECT_API_KEY_KEY_ID` (10 chars)
   - `APP_STORE_CONNECT_API_KEY_ISSUER_ID` (UUID)
   - `APP_STORE_CONNECT_API_KEY_PRIVATE_KEY` (paste the entire `.p8` file contents)
   - `TEAM_ID` (10-char Apple Team ID)
7. In Codemagic Settings → Code signing identities → connect via API key
8. Push to `main` (or click **Start new build** in Codemagic UI)
9. ~10–15 min later: build appears in App Store Connect → TestFlight tab
10. In TestFlight tab, add internal/external testers — they install via the TestFlight app on their iPhone

That's the entire pipeline. Every subsequent push to main → new TestFlight build automatically. No further manual steps.

---

## Path 3 — App Store public release (after TestFlight validation)

After Path 2 has produced a TestFlight build you've validated:

1. App Store Connect → CortexBuild → **App Store** tab
2. Fill in metadata (description, keywords, screenshots, age rating, privacy disclosures, pricing)
3. Click **Add Build** → select the latest TestFlight build
4. Click **Submit for Review**
5. Apple review usually takes 24–72 hours. They email if there are issues.
6. After approval, you can either:
   - Manually release (click "Release this version")
   - Set automatic release on approval

---

## Current status (as of this commit)

| Component                                          | Status                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------- |
| iOS Xcode project                                  | ✅ at `ios/App/App.xcodeproj`                                                    |
| Swift Package Manager deps                         | ✅ 11 Capacitor plugins                                                          |
| `Info.plist` permissions                           | ✅ camera, mic, location, photo, push                                            |
| `App.entitlements`                                 | ✅ `aps-environment = development`                                               |
| App icon (1024×1024)                               | ✅ in `Assets.xcassets/AppIcon.appiconset`                                       |
| `@capacitor/push-notifications` Swift patch        | ✅ via patch-package + postinstall                                               |
| `codemagic.yaml`                                   | ✅ uses `App.xcodeproj` (SPM-correct)                                            |
| `fastlane/Fastfile`                                | ✅ `beta` and `release` lanes                                                    |
| `ExportOptions.plist`                              | ✅ uses `__TEAM_ID__` placeholder, replaced by Codemagic at build time           |
| GitHub Actions iOS Build                           | ✅ Debug compile-only verification (Release archive needs platform SDK download) |
| Native bridges in app                              | ✅ camera, geolocation, haptics, network, push                                   |
| Web app served at `https://www.cortexbuildpro.com` | ✅ `/api/health` returns `{"status":"ok"}`                                       |

## What's blocking you from installing right now

Pick a path:

- **Path 1**: need Mac + Xcode 16.2+. Free. 7-day expiry.
- **Path 2**: need $99/yr Apple Developer + Codemagic signup. Permanent install. Ship to App Store from there.
- **Path 3**: need Path 2 already working + App Store metadata.

Everything in this repo is ready. The remaining steps are credentialed actions only you can take.
