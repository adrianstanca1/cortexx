# iOS Build & TestFlight Distribution Guide

This guide walks through building CortexBuild Field for iOS and distributing it via TestFlight for company testing.

---

## Prerequisites

| Requirement | Details |
|-------------|---------|
| Apple Developer Account | Paid account at [developer.apple.com](https://developer.apple.com) |
| Expo Account | Free account at [expo.dev](https://expo.dev) |
| EAS CLI | Installed globally: `pnpm add -g eas-cli` |
| App Store Connect | App record created at [appstoreconnect.apple.com](https://appstoreconnect.apple.com) |

---

## Step 1 — Create App on App Store Connect

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Click **My Apps → (+) New App**
3. Fill in:
   - **Platform**: iOS
   - **Name**: CortexBuild Field
   - **Bundle ID**: `space.manus.cortexbuild.field.t20260425152033`
   - **SKU**: `cortexbuild-field`
4. Save the **Apple ID** (numeric) shown — you'll need it for `eas.json`

---

## Step 2 — Configure EAS

```bash
# Log in to Expo
eas login

# Link the project to your Expo account (run from project root)
eas init --id <your-expo-project-id>
```

Update `eas.json` with your Apple details:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "Adrian.stanca1@gmail.com",
      "ascAppId": "<YOUR_APP_STORE_CONNECT_APP_ID>",
      "appleTeamId": "<YOUR_APPLE_TEAM_ID>"
    }
  }
}
```

Your **Apple Team ID** is found at [developer.apple.com/account](https://developer.apple.com/account) under Membership.

---

## Step 3 — Build for TestFlight (Preview Profile)

```bash
# From the project root
cd /path/to/cortexbuild-field

# Build iOS app for internal distribution (TestFlight)
eas build --platform ios --profile preview

# EAS will:
# 1. Ask to create/use Apple credentials (certificates + provisioning profiles)
# 2. Upload the project to EAS Build servers
# 3. Build on a macOS machine
# 4. Return a download link and IPA file
```

The build takes approximately **15–25 minutes**. Monitor at [expo.dev/accounts/adrianstanca1/projects/cortexbuild-field/builds](https://expo.dev).

---

## Step 4 — Submit to TestFlight

```bash
# After build completes, submit to TestFlight
eas submit --platform ios --profile production

# Or submit a specific build by ID
eas submit --platform ios --id <build-id>
```

EAS will upload the IPA to App Store Connect automatically.

---

## Step 5 — Add Internal Testers

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → Your App → **TestFlight**
2. Under **Internal Testing**, click **(+)** to add testers
3. Add team members by email (they need to accept the invite)
4. The build will be available in the **TestFlight app** on their iPhones within minutes

---

## Step 6 — Add External Testers (Optional)

For external company testers (up to 10,000):
1. Go to **External Testing** → **(+) New Group**
2. Add the build to the group
3. Submit for **Beta App Review** (usually approved within 24–48 hours)
4. Share the TestFlight link with testers

---

## GitHub Actions Automation

The workflow `.github/workflows/eas-build-ios.yml` automates builds:

- **Manual trigger**: Go to GitHub → Actions → "EAS Build — iOS (TestFlight)" → Run workflow
- **Tag trigger**: Push a version tag (e.g., `git tag v1.0.0 && git push --tags`)

**Required GitHub Secrets** (set at github.com/adrianstanca1/cortexbuild-field/settings/secrets):

| Secret | How to Get |
|--------|-----------|
| `EXPO_TOKEN` | [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens) |
| `VPS_HOST` | `72.62.132.43` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | Contents of `~/.ssh/manus_vps` private key |

---

## Quick Reference Commands

```bash
# Check build status
eas build:list --platform ios

# View build logs
eas build:view <build-id>

# Cancel a build
eas build:cancel <build-id>

# List submissions
eas submit:list

# Update OTA (no rebuild needed for JS changes)
eas update --branch preview --message "Fix: inspection form validation"
```

---

## OTA Updates (EAS Update)

For JavaScript-only changes (no native code changes), use **EAS Update** to push updates instantly without going through TestFlight review:

```bash
# Push an OTA update to the preview channel
eas update --branch preview --message "Bug fix: daily report submission"

# Users get the update automatically on next app launch
```

This is ideal for:
- Bug fixes in UI/logic
- Content changes
- API URL updates

**Note**: Native code changes (new permissions, new native modules) always require a full rebuild.

---

## Bundle ID

The app uses bundle ID: `space.manus.cortexbuild.field.t20260425152033`

This is set in `app.config.ts` and cannot be changed after the app is created on App Store Connect.
