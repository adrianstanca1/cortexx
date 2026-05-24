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

## Credentials before CI (non-interactive)

GitHub Actions runs `eas build` with **`--non-interactive`**, so EAS cannot prompt for Apple certificates or provisioning profiles on the runner.

**First time:** on a machine where you can sign in to Apple (your Mac is typical), from the project root:

```bash
eas login
eas build --platform ios --profile preview
```

Finish the credential wizard once (or manage credentials in the [Expo dashboard](https://expo.dev) for this project). After suitable **internal distribution** credentials exist for the `preview` profile, CI builds will get past setup.

If CI logs show:

`Couldn't find any credentials suitable for internal distribution. Run this command again in interactive mode.`

…it means this one-time (or `eas credentials`) setup has not been completed yet.

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

The workflow `.github/workflows/eas-build-ios.yml` automates builds. The profile
it runs depends on how it's triggered:

| Trigger | Profile | Behaviour |
|---------|---------|-----------|
| Manual dispatch with `profile=preview` | `preview` | Build only, no TestFlight submit (fire-and-forget, `--no-wait`) |
| Manual dispatch with `profile=production` | `production` | Build + auto-submit to TestFlight (waits for build) |
| Push tag `v*` (e.g. `v1.0.0`) | `production` | Build + auto-submit to TestFlight |

**To cut a TestFlight release**, tag main and push:

```bash
git checkout main && git pull
git tag v1.0.0
git push origin v1.0.0
```

…or trigger manually: GitHub → Actions → "EAS Build — iOS (TestFlight)" →
Run workflow → select `production`.

**API / automation (repository_dispatch)**  
If your token cannot use `workflow_dispatch` but has `contents` scope, you can start the same workflow with the [repository dispatch API](https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event):

```bash
curl -sS -X POST "https://api.github.com/repos/OWNER/REPO/dispatches" \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer YOUR_GITHUB_PAT" \
  -d '{"event_type":"eas-build-ios","client_payload":{"profile":"preview"}}'
```

Use `"profile":"production"` for a build that auto-submits to TestFlight (requires `EXPO_ASC_API_KEY_P8` as for the production manual run).

**Required GitHub Secrets** (set at github.com/adrianstanca1/cortexbuild-field/settings/secrets):

| Secret | Required for | How to get |
|--------|--------------|-----------|
| `EXPO_TOKEN` | All builds | [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens) |
| `EXPO_ASC_API_KEY_P8` | Production submit | Contents of the `AuthKey_LX9G2X2H8A.p8` ASC API key (paste the full `-----BEGIN PRIVATE KEY-----` block). The key ID + issuer ID are already in `eas.json`. |
| `VPS_HOST` | VPS deploy | `72.62.132.43` |
| `VPS_USER` | VPS deploy | `root` |
| `VPS_SSH_KEY` | VPS deploy | Contents of `~/.ssh/manus_vps` private key |

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
