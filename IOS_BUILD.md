# Cortexx — iOS build & TestFlight guide

Cortexx is a PWA. To ship it to the App Store / TestFlight you wrap the web app in
a native shell with **Capacitor**. This is the standard, fastest route. ~30 min start to TestFlight.

## Prerequisites (one-time, on a Mac)
- macOS + Xcode (App Store, free)
- Node.js 18+  (`brew install node`)
- An Apple Developer account ($99/yr) — required for TestFlight
- CocoaPods: `sudo gem install cocoapods`

## 1. Scaffold the native wrapper
From the unzipped Cortexx bundle folder:

```sh
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init Cortexx com.cortexbuild.app --web-dir .
```

`--web-dir .` tells Capacitor your built web app (Cortexx.html + lib/) is right here.

## 2. Make Cortexx.html the entry point
Capacitor loads `index.html` by default. You already have an `index.html` that
redirects to `Cortexx.html`, so it works as-is. (Or rename Cortexx.html → index.html.)

## 3. Add the iOS platform
```sh
npx cap add ios
npx cap sync ios
```

## 4. Open in Xcode
```sh
npx cap open ios
```

In Xcode:
- Select the **App** target → **Signing & Capabilities**
- Team: pick your Apple Developer team
- Bundle Identifier: `com.cortexbuild.app` (must be unique)
- Set a Version (1.0.0) and Build (1)

## 5. Set the app icon
- Drag `icon-1024.png` into Xcode → Assets → AppIcon (1024×1024 required)
- (icon.svg is in the bundle — export it to 1024px PNG first)

## 6. Build & archive for TestFlight
- In Xcode top bar: device target → **Any iOS Device (arm64)**
- Menu: **Product → Archive**
- When the Organizer opens: **Distribute App → TestFlight & App Store → Upload**
- Follow prompts (automatic signing is easiest)

## 7. TestFlight
- Go to **appstoreconnect.apple.com → your app → TestFlight**
- The build appears after ~5–15 min of processing
- Add yourself / testers under **Internal Testing**
- Testers install the **TestFlight app** on their iPhone and get Cortexx

## Capacitor config (already prepared below as capacitor.config.json)
Place this in the bundle root before `npx cap add ios`.

---

### Native niceties (optional, later)
- `npm i @capacitor/status-bar @capacitor/splash-screen @capacitor/haptics`
- Status bar style: dark, matching #06101e
- Splash screen: reuse the gradient icon
- Haptics: wire to button taps for native feel

### Why Capacitor over React Native
Cortexx is already a complete, working web app (75+ screens). Capacitor ships that
exact codebase in a native container with full access to camera, GPS, notifications,
and file system — no rewrite. A React Native port would mean rebuilding every screen.
