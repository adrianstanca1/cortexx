# fastlane usage

## Lanes

- `fastlane test` — run XCTest suite on simulator
- `fastlane build_debug` — unsigned simulator build
- `fastlane beta` — signed Release IPA → upload to TestFlight
- `fastlane release` — signed Release IPA → upload to App Store

## App Store metadata

Edit any file in `metadata/en-GB/` then run:

```bash
fastlane deliver --skip_binary_upload --skip_screenshots
```

Screenshots: drop PNGs in `screenshots/en-GB/` (size-named subfolders) then:

```bash
fastlane deliver --skip_binary_upload --skip_metadata
```

## Required environment variables (CI / local)

- `APP_STORE_CONNECT_API_KEY_KEY_ID`
- `APP_STORE_CONNECT_API_KEY_ISSUER_ID`
- `APP_STORE_CONNECT_API_KEY_PRIVATE_KEY` (or path)
- `APPLE_TEAM_ID`
- `MATCH_PASSWORD` (if using fastlane match for signing)
