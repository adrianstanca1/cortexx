# Apple App Site Association (AASA)

`apple-app-site-association` is the server-side half of iOS Universal Links.
The public endpoint is implemented by
`app/.well-known/apple-app-site-association/route.ts`, at
`https://cortexbuildpro.tech/.well-known/apple-app-site-association`, with no
`.json` extension. It returns `application/json` without requiring login.
This repository-root directory contains documentation only; Next.js does not
serve files from here. `security.txt` lives in `public/.well-known/security.txt`.
The legacy `docker-compose.yml` deployment mounts that public directory and
proxies the association endpoint and `/privacy` to the Next.js `app` service.
Other `/.well-known/*` paths receive HTTP 404 from Caddy.

## Enable associations for the signed app

1. Inspect `application-identifier` in the signed app's entitlements on macOS:
   `codesign -d --entitlements :- /path/to/Cortexx.app`. Use its full value;
   the App ID prefix is not always the Apple Developer Team ID.
2. Confirm it ends in `com.cortexbuild.app`, matching the Xcode target,
   `capacitor.config.ts` and the App Store Connect record.
3. Set `APPLE_APP_IDENTIFIER` to that verified value in the web runtime.
   For construction production, add it to `.env.construction` and recreate the
   app container using `docker-compose.construction.yml`. For the legacy Caddy
   stack, put it in the project `.env` and recreate the `app` service using
   `docker-compose.yml`. This is a runtime setting and needs no image rebuild.
4. Confirm the signed app includes both `applinks:cortexbuildpro.tech` and
   `webcredentials:cortexbuildpro.tech`. They are declared in
   `ios/App/App/App.entitlements`; the provisioning profile must permit them.

Until configured, the endpoint returns valid JSON with empty association
arrays and `Cache-Control: no-store`. A malformed identifier or a different
bundle returns HTTP 503 with no caching. Neither response claims that Universal
Links are enabled. A configured endpoint uses the modern `appIDs` / `components`
format and preserves the existing wildcard matching of all website paths.

## Verification

After configuring the web runtime:
```
curl -i https://cortexbuildpro.tech/.well-known/apple-app-site-association
# expect: HTTP/2 200, content-type application/json
# expect the verified identifier in applinks.details[0].appIDs and webcredentials.apps
```
There must be no login redirect. On a device with the signed app installed,
long-press a shared `https://cortexbuildpro.tech/portal/...` link and verify that
it offers to open the app. Apple's CDN can delay discovery of updated files;
follow [Apple's Universal Links debugging guide](https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links)
if the web response is correct but the device still opens Safari.

`webcredentials` uses the same signed identifier to authorize credential sharing.
See [Apple's associated domains documentation](https://developer.apple.com/documentation/xcode/supporting-associated-domains)
for the file format and entitlement requirements.
