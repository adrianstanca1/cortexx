# Apple App Site Association (AASA)

`apple-app-site-association` is the server-side half of iOS Universal Links.
The file is served at `https://cortexbuildpro.com/.well-known/apple-app-site-association`
with **no** `.json` extension (Apple fetches it exactly at that path).

## Before this file takes effect you MUST (on a Mac):

1. **Replace `TEAMID`** with your real 10-character Apple Developer Team ID
   (find it at https://developer.apple.com → Membership). Both occurrences.
2. Confirm the bundle ID matches the App Store Connect record AND the
   Xcode target AND `capacitor.config.ts` `appId`. There is currently a
   mismatch in the repo: `capacitor.config.ts` uses `com.cortexbuild.app`
   while the native Xcode target was generated with `app.cortexbuild.cortexx`.
   Run `npx cap sync ios` on a Mac to reconcile, then make all three identical.
3. In Xcode, enable the **Associated Domains** capability and add
   `applinks:cortexbuildpro.com` to the App target (this is the *client* half
   — cannot be done from this Linux VPS).

## Verification

After steps 1–3, from a Mac:
```
curl -I https://cortexbuildpro.com/.well-known/apple-app-site-association
# expect: HTTP/2 200, content-type application/json
```
And on a device: long-press a shared `https://cortexbuildpro.com/portal/...`
link → it should open the app, not Safari.

Note: `webcredentials` lets users save passwords to the iOS Keychain and
autofill them in the app — also gated by the same team/bundle IDs above.
