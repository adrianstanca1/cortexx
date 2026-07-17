# Cortexx — ship to the App Store

Everything you need to take the existing web app, wrap it as a native iOS binary, and submit to the App Store.

## What's in this project

```
.
├─ Cortexx.html              ← the web app (works as PWA today)
├─ manifest.json             ← PWA manifest (PNG icons + shortcuts)
├─ sw.js                     ← service worker (offline)
├─ icon.svg                  ← master icon (vector)
├─ icon-192.png              ← PWA icon (Android)
├─ icon-512.png              ← PWA icon (Android/maskable)
├─ apple-touch-icon.png      ← iOS home screen icon (180×180)
├─ lib/                      ← React/JSX components (don't ship dev React in production — see ios/README.md)
│
├─ ios/                      ← Capacitor iOS wrap (Mac only)
│   ├─ README.md             ← build instructions, day-to-day dev loop
│   ├─ package.json          ← Capacitor 6 + every native plugin
│   ├─ capacitor.config.ts   ← bundle id, splash, status bar, keyboard
│   ├─ scripts/build-web.mjs ← copies the web app into ios/www/
│   ├─ Info.plist.additions.xml ← every permission key Apple needs
│   └─ PrivacyInfo.xcprivacy ← iOS 17+ privacy manifest (required)
│
├─ app-store/                ← submission assets
│   ├─ SUBMISSION.md         ← step-by-step App Store Connect runbook
│   ├─ metadata.txt          ← listing copy (name, subtitle, description, keywords) — ready to paste
│   ├─ icons/                ← every PNG size (60 → 1024)
│   ├─ screenshots-generator.html  ← 5 hero artboards at exact 1320×2868
│   └─ screenshots/README.md ← how to capture & upload screenshots
│
└─ deploy.sh                 ← optional — deploys the PWA to a Hostinger/Nginx VPS
```

## The shortest path from here to a public App Store listing

1. **Today** — your PWA is shipping. Open the app on any iPhone Safari, **Share → Add to Home Screen**, and it installs like a native app. Offline-capable, has the four shortcut actions (Task / Scan / AI / Check in). No App Store needed.

2. **This week** — get an Apple Developer account and a Mac (or borrow one).
   - apple.com/uk/developer → enrol — about 48 hours.
   - On a Mac: `cd ios && npm install && npm run build:web && npx cap add ios && npx cap open ios`. Xcode opens. Hit ⌘R to see Cortexx running on the iOS simulator.
   - Read `ios/README.md` end-to-end — the gotchas are listed.

3. **Next week** — submit.
   - In App Store Connect (the website): create the app record, paste the listing copy from `app-store/metadata.txt`, fill in App Privacy answers per `app-store/SUBMISSION.md` §4.
   - In Xcode: bump version → Archive → Upload.
   - Generate screenshots: open `app-store/screenshots-generator.html` in Chrome → DevTools → Capture Node Screenshot for each of the 5 artboards → upload PNGs.
   - Submit for Review.

4. **24–48h later** — Apple emails you "Ready for Sale" or rejection reasons.

## What's already production-ready

- ✅ PWA install on iOS Safari (manifest, apple-touch-icon, status bar style, splash background, four app shortcuts)
- ✅ Service worker (offline cache, cache versioning)
- ✅ Bundle ID reserved-format string (`com.cortexbuild.app`)
- ✅ Privacy manifest declaring every Required Reason API Cortexx uses
- ✅ Info.plist permission strings for every iOS API (camera, mic, location, photos, contacts, calendar, biometrics, local network)
- ✅ App Store icon at 1024×1024 with no transparency, no rounded corners (Apple applies them)
- ✅ Capacitor 6 config with all native plugins pinned
- ✅ Five App Store screenshot templates at the exact required 1320×2868
- ✅ Ready-to-paste listing copy: name, subtitle, description, keywords, promotional text, what's new
- ✅ Reviewer notes covering local-first data model and AI proxy — heads off the most common rejection reasons
- ✅ Encryption export compliance answer (`ITSAppUsesNonExemptEncryption = NO`)
- ✅ Age rating: 4+, no answers needed beyond defaults
- ✅ Category: Business / Productivity

## What you still need to do yourself

| Task | Why it's on you |
|---|---|
| Pay Apple £79/yr (or $99/yr in USD) | Apple won't take my card. |
| Get a Mac with Xcode | iOS apps cannot be built or signed from anywhere else. Period. |
| Replace `com.cortexbuild.app` with **your** registered bundle ID | Each developer account owns its own. |
| Publish the privacy policy & support pages at the URLs in `metadata.txt` | App Store Connect rejects submissions with 404 URLs. |
| Capture the five PNG screenshots from `screenshots-generator.html` | Apple needs them on every submission. |
| Decide on price (free vs. paid) | I assumed Free in `SUBMISSION.md` — change it in App Store Connect if you want a paid tier. |
| Add a real Privacy Policy + Terms of Service URL | I scaffolded `https://cortexbuildpro.com/privacy` and `/support`. Make sure those pages exist. |
| Set up TestFlight beta with at least 5 testers before public release | Catches the embarrassing crash on iPhone XS or iOS 14. |

## If something goes wrong

The runbook covers the rejection reasons I've seen most often: `app-store/SUBMISSION.md` §12 ("If rejected"). The shortest summary:

- **Missing privacy declaration** → fix `PrivacyInfo.xcprivacy` + App Privacy answers
- **Crash during review** → check crash log, fix, bump build number, re-upload
- **Permission prompt without rationale** → make sure every NSXxxUsageDescription in `Info.plist.additions.xml` made it into your real `Info.plist`
- **Guideline 5.1.1** → make sure permission requests happen in-context, not at launch
- **"Required Reason API"** → declare it in `PrivacyInfo.xcprivacy` under `NSPrivacyAccessedAPITypes`

Everything else is in `app-store/SUBMISSION.md` or `ios/README.md`.

Good luck. Ship it.
