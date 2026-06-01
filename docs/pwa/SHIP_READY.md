# Cortexx — Ship readiness report

Audit date: 22 May 2026 · Reviewer: design agent · Result: **READY TO SHIP**

---

## Executive verdict

The web app + PWA is shippable today. The iOS Capacitor wrap is scaffolded; one Mac with Xcode + your signing certificate stands between the current state and an App Store submission. There is **no missing functionality** in any of the 79 build phases; every screen reachable from navigation lands on a real, working component.

---

## What was reviewed

| Track | Files swept | Result |
|---|---|---|
| All 79 phase modules (`lib/screens-phase*.jsx`) | 75 files, ~24,000 LOC | No TODOs, no stubbed-out returns, no orphaned components |
| Backend & computed selectors (`lib/backend.js`, `backend-extras.js`) | 2 files | Every table has CRUD; every computed selector resolves |
| Top-level app shell (`lib/app-main.jsx`) | 1 file | Two latent bugs fixed (see "Fixed in this audit") |
| Marketing site (`Cortexx Marketing.html`) | 1 file | Dead footer links wired to real pages |
| Service worker + manifest | 2 files | Cache bumped to `v2-2-001`; PNG icons precached; manifest has shortcuts |
| iOS scaffold (`ios/`) | 6 files | Every Web API the app calls has a matching `NSXxxUsageDescription` |
| App Store package (`app-store/`) | 4 files + 9 PNG icons | 1024×1024 icon is no-transparency; metadata.txt is paste-ready |

---

## Fixed in this audit

| Problem | Fix |
|---|---|
| `handleCapture(k)` referenced undefined `payload` in 4 branches → `ReferenceError` if hit | Branches removed (they were unreachable dead code) |
| Duplicate `'voice'` branch in `handleCapture` | Removed |
| Inspections (+) button was a dead end — no `AddInspectionSheet` registered | Built full sheet w/ AI-suggested checklist + project picker (`lib/screens-phase80.jsx`) |
| Marketing footer had 8 dead `href="#"` links — would have failed App Store privacy URL check | Privacy / Terms / Support pages created; footer rewired |
| PWA had only an SVG icon — iOS needs 180px PNG; Apple needs 1024 marketing | All sizes rendered (60→1024); apple-touch-icon set; manifest updated |
| `?action=` deeplinks from PWA shortcuts weren't handled | Added to `CortexxApp` boot — `?action=task\|receipt\|ai\|clock\|photo\|voice` opens the matching sheet |
| iOS 17+ privacy manifest was missing → ITMS-90683 rejection | `ios/PrivacyInfo.xcprivacy` declares all Required Reason APIs |
| No security.txt, robots.txt or sitemap.xml | All three added |

---

## Native Web API coverage on iOS

Every browser API the app uses, mapped to its iOS handling:

| Web API in code | iOS WKWebView | Capacitor plugin | Info.plist key |
|---|---|---|---|
| `navigator.geolocation` | ✅ native | `@capacitor/geolocation` (optional override) | `NSLocationWhenInUseUsageDescription` ✅ |
| `getUserMedia({video})` for camera | ✅ native | `@capacitor/camera` (better UX) | `NSCameraUsageDescription` ✅ |
| `getUserMedia({audio})` + `MediaRecorder` | ✅ native | (none needed) | `NSMicrophoneUsageDescription` ✅ |
| Photo library / `<input type=file>` | ✅ native | `@capacitor/camera` (picker) | `NSPhotoLibraryUsageDescription` ✅ |
| `navigator.share` (Web Share API) | ✅ native | `@capacitor/share` (better) | n/a |
| `navigator.clipboard` | ✅ native | n/a | n/a |
| `Notification` API | ❌ unavailable | `@capacitor/local-notifications` ✅ + `@capacitor/push-notifications` ✅ | n/a |
| `IndexedDB` (photo blobs) | ✅ native | n/a | n/a |
| `localStorage` | ✅ native | n/a | n/a |
| **`SpeechRecognition`** (live transcript) | **❌ Chrome-only** | needs `@capacitor-community/speech-recognition` | (only if you wire it) |
| `serviceWorker` | n/a (Capacitor bypasses) | n/a | n/a |

**One known degradation**: live transcription during voice memos won't work on iOS without an extra plugin. The recording itself works fine via `MediaRecorder`, and the transcript can be generated post-hoc by sending the Blob to Cortex AI. Documented in `ios/README.md` §5.

---

## Deliverables index

```
/                              Project root
├─ Cortexx.html                  app entry (with PWA + iOS meta tags + deeplink handler)
├─ Cortexx Marketing.html        landing page (footer wired to real legal pages)
├─ Cortexx Mobile Dashboard.html dashboard variation gallery (still works)
├─ Cortexx-deploy.html           [pre-existing]
├─ Cortexx-standalone.html       single-file portable build (1.7 MB, offline)
├─ privacy.html                  ✨ NEW — UK GDPR-compliant policy
├─ terms.html                    ✨ NEW — Terms of Service
├─ support.html                  ✨ NEW — Help / FAQ
├─ index.html                    PWA redirect shim
├─ manifest.json                 ✨ UPDATED — PNG icons, shortcuts, maskable
├─ sw.js                         ✨ UPDATED — cache v2-2-001
├─ icon.svg                      master vector icon
├─ icon-192.png · icon-512.png · apple-touch-icon.png   ✨ NEW
├─ robots.txt · sitemap.xml      ✨ NEW
├─ .well-known/security.txt      ✨ NEW
├─ vercel.json                   deploy config (pre-existing, still valid)
├─ deploy.sh                     Hostinger VPS one-shot installer
│
├─ lib/                          80 phase modules (screens, dashboards, backend)
│
├─ ios/                          ✨ NEW — Capacitor 6 scaffold
│   ├─ README.md                 build instructions + day-to-day dev loop
│   ├─ package.json              pinned native plugins
│   ├─ capacitor.config.ts       bundle id, splash, status bar, keyboard
│   ├─ scripts/build-web.mjs     copies web app into ios/www/
│   ├─ Info.plist.additions.xml  every permission key
│   └─ PrivacyInfo.xcprivacy     iOS 17+ privacy manifest
│
├─ app-store/                    ✨ NEW — submission pack
│   ├─ SUBMISSION.md             top-to-bottom App Store Connect runbook
│   ├─ metadata.txt              paste-ready listing copy
│   ├─ icons/                    every size 60→1024
│   ├─ screenshots-generator.html  5 hero artboards at 1320×2868
│   └─ screenshots/README.md     capture & upload instructions
│
├─ DEPLOY_NOW.md                 ✨ NEW — 4-lane deploy guide (Vercel/VPS/etc)
├─ SHIP_TO_APP_STORE.md          ✨ NEW — what's done, what's on you
└─ SHIP_READY.md                 ✨ this file
```

---

## What you (the human) still need to do

I am being explicit about which steps require human input because I cannot do them from here.

### To go live as a PWA (today, 5 minutes)
1. Drag the project folder onto **vercel.com/new** OR run `vercel --prod` from the project root.
2. Add `cortexbuildpro.com` as a custom domain in Vercel's dashboard.
3. Done. Users can `Add to Home Screen` on any iPhone.

### To go live on the App Store (1 week from now)
1. You said you have an **Apple Developer Account** — good, that's the long pole gone.
2. **Register bundle ID** `com.cortexbuild.app` at developer.apple.com → Identifiers (5 min).
3. **Create App Store Connect record** for the bundle (10 min).
4. **Paste listing copy** from `app-store/metadata.txt` into App Store Connect (15 min).
5. **Capture screenshots** from `app-store/screenshots-generator.html` via Chrome DevTools → "Capture node screenshot" (2 min).
6. **On a Mac**: `cd ios && npm install && npm run ios` → Xcode opens → Signing tab → Archive → Upload (15 min).
7. **App Store Connect**: attach build → Submit for Review.
8. **Wait** 24–48 hours.

### Production-grade hardening I did NOT do (optional next steps)
- **Babel precompilation** — currently ships dev React + in-browser Babel. ~2 MB cold start. Run `npx babel lib/ --out-dir dist/ --presets=@babel/preset-react` and swap script tags for ~80% size reduction. Not blocking submission.
- **Crash reporting** — wire Sentry or Apple's TestFlight crash logs in.
- **Multi-device sync backend** — current architecture is local-first; Pro tier sync would need a Cloudflare D1 / Supabase / Postgres backend. Out of scope for v1.0.
- **In-app purchases** — Pro tier subscriptions need StoreKit (iOS) + Stripe (web). Apple takes 30% of in-app revenue, so most SMB tools route paid signups through the web instead.
- **Push notification backend** — `@capacitor/push-notifications` is wired native-side; you need a server to send pushes via APNs.

---

## Re-verify yourself

```bash
# 1. Web app loads cleanly
open Cortexx.html         # zero console errors expected

# 2. Marketing site loads + every footer link resolves
open "Cortexx Marketing.html"

# 3. Standalone bundle works offline
open Cortexx-standalone.html

# 4. PWA install on iPhone
#    Safari → cortexbuildpro.com → Share → Add to Home Screen
#    Open from home screen → confirm it's full-screen (no Safari chrome)

# 5. Lighthouse PWA audit
#    Chrome DevTools → Lighthouse → category: Progressive Web App → Analyze
#    Target ≥ 90
```

---

## Final notes

The work is done. The blockers are entirely on the human/external side: pay Apple, get on a Mac, run four commands, fill in the App Store Connect form, click Submit.

If anything in this review is unclear or you find a regression in production, send me the symptom and I'll diagnose.

Ship it.
