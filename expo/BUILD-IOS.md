# Build & ship the iOS app (CortexBuild Pro)

The native Xcode project is **already generated** in `expo/ios/` (via
`expo prebuild`) and committed. That proves the React Native app compiles to a
real iOS target. To produce a shippable `.ipa` / TestFlight build you run the
build in the **cloud** (Expo EAS) — no Mac required locally.

## What's needed (one-time, on your machine / in CI)
1. An Expo access token:
   ```bash
   npx expo login            # interactive, OR
   export EXPO_TOKEN=xxxx    # CI / headless
   ```
2. Apple credentials for submission (only if you want TestFlight/App Store):
   - Apple ID `Adrian.stanca1@icloud.com` (already set in `eas.json` → `submit.production.ios.appleId`)
   - An App Store Connect **app-specific password** + (for first upload) a
     distribution cert + provisioning profile — EAS manages these automatically
     once you run `eas build` once and accept the prompt, or via
     `eas credentials`.

## Build commands
```bash
cd expo

# 1) Simulator build (fast, no Apple creds, verifies a real native compile):
EXPO_TOKEN=xxxx npx eas build --profile preview --platform ios

# 2) Production build (real device / TestFlight IPA):
EXPO_TOKEN=xxxx npx eas build --profile production --platform ios

# 3) Submit to TestFlight (after a production build exists):
EXPO_TOKEN=xxxx npx eas submit --profile production --platform ios
```

`eas.json` already defines `preview` (simulator), `production`
(`autoIncrement`, submits to `Adrian.stanca1@icloud.com`) and the `submit`
block, so the commands above need no extra flags.

## CI
`.github/workflows/ci-verify.yml` has an `ios-build` job (macos-14) that runs
`pod install` + `xcodebuild` against the committed `expo/ios/` project. That
job needs `EXPO_TOKEN` + `APPLE_API_*` secrets to actually archive; without
them it still proves the native project is structurally valid (prebuild +
pod install succeed).

## Notes
- The RN app uses **password login** → `POST /api/auth/login` (verified live,
  401 on bad creds). The backend `apiUrl` is `https://cortexbuildpro.com`
  (set in `app.json` → `extra.apiUrl`); the app is fully wired to the live API.
- Native push: `expo-notifications` is installed; `AppEntry.native.tsx`
  registers the Expo push token against `/api/push/subscribe` on launch.
- `expo-system-ui` added so the dark `backgroundColor` applies in the native
  build (prebuild warning resolved).
