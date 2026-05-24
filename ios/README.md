# Cortexx — iOS build (Capacitor)

This folder wraps the existing Cortexx web app as a native iOS application using **Capacitor 6**. The whole web app — every screen, dashboard, dialog, AI flow, local-first store — runs unchanged inside a WKWebView. Native plugins are wired in for camera, geolocation, microphone, haptics, push notifications, local notifications, and biometric unlock.

> **You will need a Mac** with Xcode 15.4 or newer to build and submit. Everything below assumes macOS.

> ## ⚠️ Heads-up: this scaffold targets the static PWA build
>
> This scaffold was originally built for **`cortexx-pwa`** — the sibling repo that ships Cortexx as a single static `Cortexx.html` file. `scripts/build-web.mjs` copies that file into `ios/www/index.html`, which is then bundled into the iOS app.
>
> This codebase (the Next.js app) doesn't have a static `Cortexx.html`. To produce a build that works on an iPhone offline, you have **two options**:
>
> 1. **Static-export Next.js** — add `output: 'export'` to `next.config.js`, run `next build`, then point `webDir` at `out/`. This works for client-rendered pages but breaks any route that uses `force-dynamic` or server actions — and the bulk of `/api/*` does. Practical for marketing/demo only.
> 2. **Point Capacitor at the deployed URL** — uncomment the `server.url` block in `capacitor.config.ts` and set it to `https://cortexbuildpro.com`. The native shell loads the live web app every launch; offline mode is gone but the entire backend works. This is the path of least resistance for shipping a TestFlight beta.
>
> Mixing the two (a small offline shell that hands off to the cloud) is on the roadmap once the Auth flow is mobile-friendly.

---

## 0 · Prerequisites (one time)

```bash
# 1. macOS with Xcode 15.4+ — install from the Mac App Store, then run once
xcode-select --install
sudo xcodebuild -license accept

# 2. Node 20 LTS
brew install node@20

# 3. CocoaPods (Capacitor uses it for native deps)
brew install cocoapods
```

You also need:
- **Apple Developer Program membership** — £79/yr or $99/yr (apple.com/uk/developer)
- A unique **Bundle Identifier** registered at developer.apple.com → Certificates, IDs & Profiles → Identifiers. We use `app.cortexbuild.cortexx` in `capacitor.config.ts`; change it to one you own.
- An **App Store Connect** record for the app (appstoreconnect.apple.com → My Apps → +).

---

## 1 · First-time scaffold

From inside `ios/`:

```bash
npm install
npm run build:web        # copies public/legacy/ → ios/www/ + disables the SW
npx cap init Cortexx app.cortexbuild.cortexx --web-dir www
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

# Capacitor 6 expects a single 1024×1024 icon in the asset catalog; Xcode handles the rest.
cp ../app-store/icons/icon-1024.png App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png
```

Then in Xcode, open **Assets.xcassets** → **AppIcon** → drag `AppIcon-1024.png` into the **App Store** slot. Xcode will generate every other size on build.

> Or use a tool like `npx @capacitor/assets generate --iconBackgroundColor "#06101e"` from the project root pointing at `app-store/icons/icon-1024.png` to populate all slots automatically.

### Sign the app

In Xcode → select the `App` target → **Signing & Capabilities**:
- ☑ Automatically manage signing
- Team: your Apple Developer team
- Bundle Identifier: `app.cortexbuild.cortexx` (must match what you registered)

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

The file `ios/ci/ios-build.workflow.yml` contains the complete GitHub Actions workflow for automated App Store builds. To activate it:

1. On your Mac, clone the repo and run:
   ```bash
   mkdir -p .github/workflows
   cp ios/ci/ios-build.workflow.yml .github/workflows/ios-build.yml
   git add .github/workflows/ios-build.yml
   git commit -m "ci(ios): activate iOS App Store build workflow"
   git push origin cortexbuildpro
   ```

2. Then add the 8 GitHub Secrets listed in `app-store/SUBMISSION.md` (section 4b).

Once active, every push to `cortexbuildpro` that touches `ios/` or `Cortexx.html` will automatically archive, sign, and upload to TestFlight.
