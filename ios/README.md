# Cortexx — iOS build (Capacitor)

This folder wraps the existing Cortexx web app as a native iOS application using **Capacitor 8**. The whole web app — every screen, dashboard, dialog, AI flow, local-first store — runs unchanged inside a WKWebView. Native plugins are wired in for camera, geolocation, microphone, haptics, push notifications, local notifications, and biometric unlock. Minimum iOS deployment target is **15.0** (Capacitor 8 requirement).

> **You will need a Mac** with Xcode 15.4 or newer to build and submit. Everything below assumes macOS.

> ## Two build modes
>
> `capacitor.config.ts` and `scripts/build-web.mjs` both consult the
> `CAPACITOR_SERVER_URL` env var to pick the distribution mode.
>
> ### 🌐 Cloud mode (recommended for TestFlight)
>
> ```bash
> CAPACITOR_SERVER_URL=https://cortexbuildpro.com npm run build:web
> npx cap sync ios
> npx cap open ios   # then Archive in Xcode
> ```
>
> `server.url` is added to the Capacitor config, `ios/www/` gets a tiny
> placeholder `index.html`, and the WKWebView loads the live Next.js
> app on every launch. The full backend works — auth, Postgres, SSE,
> Ollama `/ask`, whisper.cpp `/api/transcribe`, PDF endpoints. Always
> up to date. Online-only.
>
> ### 📦 Offline mode (single-file PWA bundle)
>
> ```bash
> npm run build:web        # CAPACITOR_SERVER_URL unset
> npx cap sync ios
> npx cap open ios
> ```
>
> Copies `public/legacy/` (the consolidated single-file PWA, formerly
> the standalone `cortexx-pwa` repo) into `ios/www/`. The bundle is
> self-contained — works on aeroplane mode, no backend. State lives in
> `localStorage` / `IndexedDB` inside the WebView. The build script
> also patches `index.html` to disable the service worker (the WKWebView
> serves files from the bundle directly).
>
> Mix-and-match (small offline shell that hands off to the cloud) is
> the natural next step once the Auth flow is mobile-friendly.

---

## 0 · Prerequisites (one time)

```bash
# 1. macOS with Xcode 15.4+ — install from the Mac App Store, then run once
xcode-select --install
sudo xcodebuild -license accept

# 2. Node 22 LTS (Capacitor CLI 8 requires Node >=22)
brew install node@22

# 3. CocoaPods (Capacitor uses it for native deps)
brew install cocoapods
```

You also need:
- **Apple Developer Program membership** — £79/yr or $99/yr (apple.com/uk/developer)
- A unique **Bundle Identifier** registered at developer.apple.com → Certificates, IDs & Profiles → Identifiers. We use `com.cortexbuild.app` in `capacitor.config.ts`; change it to one you own.
- An **App Store Connect** record for the app (appstoreconnect.apple.com → My Apps → +).

---

## 1 · First-time scaffold

From inside `ios/`:

```bash
npm install
npm run build:web        # copies public/legacy/ → ios/www/ + disables the SW
npx cap init Cortexx com.cortexbuild.app --web-dir www
npx cap add ios
```

This creates `ios/App/` — a fully-formed Xcode project.

> **What `build:web` does now (24 May 2026)**  
> Reads from `public/legacy/` (the consolidated single-file PWA bundle, formerly the standalone `cortexx-pwa` repo) and copies the whole thing into `ios/www/`. The PWA's relative paths already point at `dist/`, `lib/`, `manifest.json` etc., so the WebView serves everything offline. The script also patches the SW registration in `index.html` to a no-op — the WebView serves files from the bundle directly, no service worker needed.  
> If you'd rather not bundle the static PWA at all, the alternative is to set `server.url = 'https://cortexbuildpro.com'` in `capacitor.config.ts` — the native shell then loads the live Next.js app on each launch. Online-only, but always up to date and uses the real Postgres.

### Apply the privacy + permission files

Apple will reject the build if these are missing.

1. Open `ios/App/App/Info.plist` in Xcode. Paste **every key** from `Info.plist.additions.xml` into the existing top-level `<dict>`. Adjust the user-facing strings if you change wording.
2. Copy `ios/PrivacyInfo.xcprivacy` to `ios/App/App/PrivacyInfo.xcprivacy`. In Xcode, drag it into the `App` group so it becomes part of the target.

### Drop the app icons in

```bash
# from ios/
mkdir -p App/App/Assets.xcassets/AppIcon.appiconset

# Capacitor 8 expects a single 1024×1024 icon in the asset catalog; Xcode handles the rest.
cp ../app-store/icons/icon-1024.png App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png
```

Then in Xcode, open **Assets.xcassets** → **AppIcon** → drag `AppIcon-1024.png` into the **App Store** slot. Xcode will generate every other size on build.

> Or use a tool like `npx @capacitor/assets generate --iconBackgroundColor "#06101e"` from the project root pointing at `app-store/icons/icon-1024.png` to populate all slots automatically.

### Sign the app

In Xcode → select the `App` target → **Signing & Capabilities**:
- ☑ Automatically manage signing
- Team: your Apple Developer team
- Bundle Identifier: `com.cortexbuild.app` (must match what you registered)

Add the **Background Modes** capability if you want background mileage tracking or push notifications:
- ☑ Location updates
- ☑ Remote notifications
- ☑ Background fetch

---

## 2 · Day-to-day dev loop

```bash
npm run ios            # rebuilds www/, syncs Capacitor, opens Xcode
```

Then ⌘R in Xcode to launch the simulator. To run on a physical iPhone:
1. Plug it in, trust the computer.
2. Xcode → top bar → pick your iPhone as the target.
3. Xcode → Settings → Accounts → make sure your Apple ID is added.
4. ⌘R.

For live-reload during development uncomment the `server.url` block in `capacitor.config.ts` and serve the project root with any static server (e.g. `npx serve ..` from inside `ios/`).

---

## 3 · App Store submission

See `../app-store/SUBMISSION.md` for the end-to-end checklist (screenshots, copy, age rating, privacy answers, review notes, TestFlight, etc).

The short version, once Xcode is signing happily:

```text
Xcode → Product → Destination → Any iOS Device (arm64)
Xcode → Product → Archive
Organizer window opens automatically → Distribute App → App Store Connect → Upload
```

The upload runs through Apple's automated checks; you'll get an email in 5–30 minutes saying the build is ready in App Store Connect. Then attach it to the version you created in step 0 and hit **Submit for Review**.

Apple's first review usually comes back in 24–48 hours.

---

## 4 · What's wired natively

| Capability                   | Plugin                                | Falls back to web API |
|------------------------------|---------------------------------------|-----------------------|
| Camera (receipts, snags)     | `@capacitor/camera`                   | `<input type=file capture>` |
| Geolocation (check-in)       | `@capacitor/geolocation`              | `navigator.geolocation` |
| Voice memos                  | `@capacitor/voice-recorder` (3rd party) | `MediaRecorder` |
| Haptics                      | `@capacitor/haptics`                  | (no-op) |
| Status bar style             | `@capacitor/status-bar`               | meta tag |
| Splash screen                | `@capacitor/splash-screen`            | n/a |
| Keyboard resize              | `@capacitor/keyboard`                 | n/a |
| Local notifications          | `@capacitor/local-notifications`      | `Notification` |
| Push notifications           | `@capacitor/push-notifications`       | n/a |
| File save / share            | `@capacitor/filesystem`, `@capacitor/share` | `navigator.share` |
| Biometric unlock             | `capacitor-native-biometric` (3rd party) | n/a |
| Offline storage              | (already native: `localStorage` + IndexedDB inside WKWebView) | — |

The web code already detects which APIs are available and degrades gracefully — you don't have to rewrite anything.

---

## 5 · Common pitfalls

- **White screen on launch** → almost always means `www/index.html` is missing. Run `npm run build:web` and check `ios/www/` has files.
- **Camera prompt crashes the app** → you forgot `NSCameraUsageDescription` in Info.plist. Add it from `Info.plist.additions.xml`.
- **"This app cannot be installed because its integrity could not be verified"** → signing certificate problem. Xcode → Window → Devices and Simulators → unpair iPhone → re-trust.
- **Upload to App Store Connect fails with ITMS-90683** → missing privacy manifest. Make sure `PrivacyInfo.xcprivacy` is in the Xcode target.
- **Rejected for using Required Reason API** → declare it in `PrivacyInfo.xcprivacy` under `NSPrivacyAccessedAPITypes`. Cortexx's are already there; add yours.
- **WKWebView shows a blank `index.html`** but Safari is fine → check the build output by running on the simulator first. The simulator surfaces JS errors in Xcode's console.
- **Voice memos record but no live transcript on iOS** → expected. iOS WKWebView doesn't support the Web Speech API (Chrome-only). Audio capture via `MediaRecorder` works fine, and you can run AI transcription on the resulting Blob after recording. For *live* on-device transcription on iOS, add the `@capacitor-community/speech-recognition` plugin and wire it into `VoiceMemoSheetReal` (look for `window.SpeechRecognition` in `lib/screens-phase77.jsx`).

---

## CI/CD — GitHub Actions iOS Build

**Active workflow: `.github/workflows/release-ios.yml`** (live on the
default branch).

Triggers:
- **Tag push** matching `v*-ios` (e.g. `git tag v1.0.0-ios && git push --tags`) —
  the release-train path. Tag a commit, push, the IPA goes up to TestFlight.
- **workflow_dispatch** — manual one-off builds with a toggle for whether
  to upload to TestFlight or just archive the IPA artifact.

Both produce: signed Release IPA + dSYM, uploaded as a workflow artifact,
optionally pushed to TestFlight via `xcrun altool`.

Required GitHub secrets (one-time setup):
| Secret | Source |
|---|---|
| `APPLE_TEAM_ID` | developer.apple.com → Account → Membership |
| `IOS_CERTIFICATE_BASE64` | export the iPhone Distribution `.p12` and `base64` it |
| `IOS_CERTIFICATE_PASSWORD` | the export password set when exporting the `.p12` |
| `IOS_KEYCHAIN_PASSWORD` | a throwaway password for the ephemeral CI keychain |
| `IOS_PROVISIONING_PROFILE_BASE64` | the App Store distribution profile, base64-encoded |
| `APP_STORE_CONNECT_KEY_ID` | App Store Connect → Users & Access → Keys |
| `APP_STORE_CONNECT_ISSUER_ID` | same page |
| `APP_STORE_CONNECT_KEY_BASE64` | the `.p8` private key, base64-encoded |

See `../app-store/SUBMISSION.md` for the screenshots / copy / privacy /
review-notes side of the checklist.

> **Note**: `ios/ci/ios-build.workflow.yml` is the same content kept as
> a reference doc (it has `.workflow.yml` not `.yml` so GitHub doesn't
> double-run it). The authoritative copy is in `.github/workflows/`.
