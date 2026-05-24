# Cortexx — App Store submission checklist

Follow this top to bottom. Don't skip steps — Apple will reject for any one of them.

---

## 1 · Before you can submit anything

| Item | Where | Notes |
|---|---|---|
| Apple Developer Program | developer.apple.com | £79/yr (UK) or $99/yr. Pay first; account verification can take 24–48h. |
| Mac with Xcode 15.4+ | App Store on macOS | You cannot submit from Windows or Linux. Period. |
| Bundle ID registered | developer.apple.com → Certificates, IDs & Profiles → Identifiers | Use `app.cortexbuild.cortexx` or your own. Cannot be changed after first upload. |
| App record in App Store Connect | appstoreconnect.apple.com → My Apps → + | Pick the bundle ID. SKU = any unique string (e.g. `CORTEXX-1`). |
| DUNS number (orgs only) | dnb.com | Free for sole traders; required if filing under a company name. |

---

## 2 · App Store Connect — App Information

Open your app in App Store Connect → **App Information** tab.

| Field | Cortexx value |
|---|---|
| Primary category | Business |
| Secondary category | Productivity |
| Content rights | Yes, the app contains third-party content (only if you embed any) — usually **No** |
| Age rating | Click **Edit** → answer the questionnaire. Cortexx = **4+** (no restricted content). |
| Privacy Policy URL | https://cortexbuildpro.com/privacy (required) |
| Support URL | https://cortexbuildpro.com/support (required) |
| Marketing URL | https://cortexbuildpro.com (optional but recommended) |
| Contact information | Public phone & email for App Review to reach you |
| Routing app coverage file | n/a (not a navigation app) |

---

## 3 · Pricing & Availability

- **Price**: Free (or your tier).
- **Availability**: United Kingdom only at launch. (Add territories later when you have CIS-equivalent flows.)
- **App Distribution Methods**: Public on the App Store.
- **Pre-Orders**: Off.

---

## 4 · App Privacy

App Store Connect → **App Privacy** → **Get Started**.

For each category below, declare **Data Used to Track You = NO** (Cortexx does not use ATT) and **Data Linked to User = YES**. All purposes = **App Functionality** only.

- **Contact Info**: Name, Email, Phone (only if user opts in to invoice features)
- **User Content**: Photos or Videos, Audio Data, Other User Content
- **Identifiers**: User ID (the local profile)
- **Location**: Precise Location, Coarse Location
- **Diagnostics**: Crash Data, Performance Data (only if you wire crash reporting)

> Cortexx's `PrivacyInfo.xcprivacy` already declares these on the binary side — App Store Connect requires the same declaration in the dashboard, separately.

---

## 4b · GitHub Actions CI/CD Secrets

For the automated `ios-build.yml` workflow to sign and upload builds, add these secrets to the **cortexx-pwa** repo (Settings → Secrets and variables → Actions):

| Secret name | How to get the value |
|---|---|
| `IOS_CERTIFICATE_BASE64` | `base64 -i Certificates.p12 \| pbcopy` |
| `IOS_CERTIFICATE_PASSWORD` | Password you set when exporting the .p12 |
| `IOS_KEYCHAIN_PASSWORD` | Any strong random string (used only on the runner) |
| `IOS_PROVISIONING_PROFILE_BASE64` | `base64 -i Cortexx_AppStore.mobileprovision \| pbcopy` |
| `APPLE_TEAM_ID` | 10-character team ID from developer.apple.com (e.g. `ABC123DEF4`) |
| `APP_STORE_CONNECT_KEY_ID` | Key ID from App Store Connect → Users & Access → Integrations |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID from the same page |
| `APP_STORE_CONNECT_KEY_BASE64` | `base64 -i AuthKey_KEYID.p8 \| pbcopy` |

Once these are set, every push to `cortexbuildpro` that touches `ios/` or `Cortexx.html` will trigger a full archive + TestFlight upload automatically.

---

## 5 · Build the binary

Inside the project's `ios/` folder, on a Mac:

```bash
npm install
npm run build:web
npx cap sync ios
npx cap open ios
```

In Xcode:

1. **Select target**: `App` → top bar pickers → set destination to **Any iOS Device (arm64)**.
2. **Bump version**: `App` target → **General** → set Version (e.g. `1.0.0`) and Build (e.g. `1`). Build must increase every upload.
3. **Signing**: `App` target → **Signing & Capabilities** → ☑ Automatically manage signing, pick your Team.
4. **Archive**: menu **Product → Archive**. Takes 1–3 min.
5. **Distribute**: in the Organizer window that opens → **Distribute App → App Store Connect → Upload → Next, Next, Upload**.

You'll get an email titled "Your app has completed processing" in 5–30 minutes when the build appears in App Store Connect under TestFlight → Builds.

---

## 6 · Screenshots — required sizes

Apple still requires screenshots for both the largest iPhone and (if your app supports iPad) iPad Pro.

| Device | Resolution | File names in `app-store/screenshots/` |
|---|---|---|
| **iPhone 6.9"** (iPhone 16 Pro Max, 15 Pro Max) | **1320 × 2868 px** | `iphone-69-01.png`, …, `iphone-69-10.png` |
| iPhone 6.5" (XS Max, 11 Pro Max) | 1284 × 2778 px | optional |
| iPhone 5.5" (8 Plus) | 1242 × 2208 px | optional, no longer required |
| **iPad Pro 13"** (M4) | **2064 × 2752 px** | `ipad-13-01.png`, … (only if you support iPad) |
| iPad Pro 12.9" 6th gen | 2048 × 2732 px | optional |

Minimum **3** per device, recommended **6–10**. The first one is your hero — it shows up in search results.

**Suggested screen order for Cortexx:**
1. Dashboard (V15 Site Notice or V5 AI-forward — most visually striking)
2. Cortex AI chat answering a real question
3. Projects screen with progress bars
4. Receipt scan with vision OCR result on screen
5. Quote estimator with line items
6. Site diary with photos
7. Snag list with priorities
8. Team training matrix
9. Settings / Privacy
10. Marketing splash

App Store screenshots can have a marketing frame (text + device bezel) overlaid on the actual content — Apple allows this as long as the device frame is realistic and the UI is recognisable.

---

## 7 · App Preview videos (optional but recommended)

Apple App Preview: 15–30 seconds, **portrait orientation**, **886 × 1920** for iPhone, no narration over the first 1 second, can include a logo card at the start/end. Record the simulator with QuickTime → File → New Movie Recording → switch input to the device.

---

## 8 · App Information — store listing copy

Paste this in App Store Connect → **App Store** tab → **iOS App** version.

### App Name
`Cortexx — Construction OS`

### Subtitle (30 chars)
`AI ops for UK contractors`

### Promotional Text (170 chars — can update without resubmitting)
> The AI-powered ops platform built for UK SMB contractors. Quotes, projects, CIS-aware accounting, RAMS, snags and site diary — all in one app.

### Description (4000 chars)

```
Cortexx is the construction OS that thinks with you. Built for UK SMB contractors — sole traders, refurb specialists, fit-out crews, small main contractors — it replaces the spreadsheets, paper files and disconnected apps you're juggling now.

CORTEX AI — your AI ops manager
Ask anything: "what's my cashflow this week", "draft a chase email for INV-2039", "what should I order tomorrow", "summarise today's site diary for the client". Cortex sees your live data and answers in plain UK English.

WHAT'S INSIDE
• Projects — phases, progress, margin, photos
• AI Quote Estimator — describe a job, get a fully itemised quote
• Invoices & chases — auto-draft polite chase emails
• CIS-aware accounting — deductions calculated correctly
• RAMS, Permits, Inspections — UK-specific safety stack
• Photo → Snag with vision AI — point your camera at a defect, get a snag filed
• Receipt scanning — vision OCR pulls vendor, amount, VAT, date
• Site diary — daily logs with weather, crew, photos, AI summary for the client
• Team — CSCS tracking, training matrix, certificate expiry alerts
• Timesheets with CIS flag
• RFIs and document control
• Variations / change orders
• Mileage tracking (HMRC-compliant)
• Customer & lead pipeline
• Voice memos with AI transcription
• Drawings viewer
• Client portal
• Apprentice tracker, holiday, payroll, carbon, waste

WORKS OFFLINE
All your data lives on your device. No subscription required to keep using what you've already created. We back you up to the cloud if you want; we don't lock you in.

PRIVACY-FIRST
Cortexx is local-first. Your project data, photos and financial records stay on your phone until you choose to sync. We don't track you across apps and we never sell your data.

15 DASHBOARD LAYOUTS
From "Action-first" for site managers to "Executive at-a-glance" for owners, swap layouts to match how you actually think about your business.

Made in the UK. Built by builders.
```

### Keywords (100 chars — comma-separated, no spaces around commas)
`construction,builder,contractor,CIS,UK,RAMS,quotes,invoices,site,trades,SMB,subbie,refurb,snag,diary`

### Support URL
`https://cortexbuildpro.com/support`

### Marketing URL (optional)
`https://cortexbuildpro.com`

### Copyright
`© 2026 CortexBuild Ltd`

---

## 9 · App Review Information

This is what gets your app in front of a human reviewer at Apple. Fill it in thoroughly — vague answers get rejected.

| Field | Value |
|---|---|
| First Name / Last Name | _your name_ |
| Phone | _your phone, must answer if Apple calls_ |
| Email | adrian@cortexbuild.app |
| Demo account username | _create a test user the reviewer can sign in as_ |
| Demo account password | _a real password_ |
| Notes for the reviewer | (see below) |
| Attachment | (optional) a screenshot tour PDF |

### Notes for reviewer (paste this)

> Cortexx is a local-first business app for UK construction SMBs. There is no account creation required to use the app — on first launch, a sample workspace loads automatically with realistic seed data so the reviewer can explore every feature without signing up.
>
> All AI features (Cortex AI chat, AI quote estimator, receipt OCR, photo-to-snag, voice transcription) call Anthropic's Claude via a server-side proxy. No third-party API keys are embedded in the app.
>
> The app supports iOS 14+ and is portrait-only on iPhone, multi-orientation on iPad. It uses standard iOS permissions for camera (receipt/photo capture), microphone (voice memos), photo library (attaching existing photos), and location (site check-in, mileage). Each permission is requested in-context with a clear rationale, and the app continues to function without any of them.
>
> No external login is needed for the reviewer. Just open the app, accept onboarding, and explore.

---

## 10 · Version Release

- **Release this version**: pick **Automatically release this version** if you trust Apple's review to be clean, or **Manually release this version** to control the exact moment.
- **Phased Release for Automatic Updates**: ☑ Yes (rolls the update out over 7 days; safer).

---

## 11 · TestFlight (optional but recommended)

Before pushing to public release, drop the build into TestFlight to catch crashes.

1. App Store Connect → **TestFlight** tab → pick your build.
2. **Test Information** — fill the beta description, feedback email, marketing URL.
3. **Internal Testing** — add up to 100 internal testers (instant access, no Apple review).
4. **External Testing** — add a public link or up to 10,000 external testers. **First external build needs Apple to approve it** (24h-ish).

---

## 12 · Submit

App Store Connect → version → bottom of the page → **Add for Review** → **Submit to App Review**.

Apple's first-pass timing in 2026: usually 24–48h. You'll get an email at every status change (`In Review`, `Pending Developer Release`, `Ready for Sale`).

**If rejected**: the email tells you why. Common reasons:
- Missing privacy declaration → fix `PrivacyInfo.xcprivacy` or App Privacy answers
- Crash during review → check the attached crash log, fix, bump build number, re-upload
- Guideline 4.2 "minimum functionality" → does your app actually do enough? Cortexx is fine here.
- Guideline 5.1.1 "data collection without consent" → make sure every permission is requested in-context

You can reply through Resolution Center; Apple usually answers within 12h.

---

## 13 · After Go-Live

- Set up **App Analytics** (free in App Store Connect → Analytics) — installs, retention, crashes.
- Add a **What's New** entry for every release.
- Respond to reviews within 24h — Apple ranks responsive devs higher in search.
- Monitor crashes weekly. A spike usually means a recent build broke on a specific iOS version.

---

## 14 · Files in this folder

| File | What it is |
|---|---|
| `SUBMISSION.md` (this file) | The runbook you're reading. |
| `icons/icon-1024.png` | Marketing icon for App Store Connect (no transparency, no rounded corners). |
| `icons/icon-180.png`, `120.png`, etc. | All other sizes. Most are auto-generated by Xcode from the 1024. |
| `screenshots/iphone-69-*.png` | Required iPhone screenshots (1320×2868). |
| `screenshots/ipad-13-*.png` | iPad Pro 13" screenshots if you support iPad. |
| `screenshots/README.md` | How they were rendered + how to regenerate. |
| `metadata.txt` | Plain-text listing copy you can copy/paste. |
| `../ios/` | The Capacitor wrap. See `../ios/README.md` for the build steps. |

---

Good luck. The first submission feels like a lot, but every subsequent release is just **build → archive → upload → submit**. Most days it's 10 minutes from "I want to ship this" to "it's queued for review".
