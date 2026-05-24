# App Store Screenshots

Required sizes (3-10 each):

- `iPhone 6.7": ` 1290×2796 (iPhone 15/16 Pro Max)
- `iPhone 6.1": ` 1179×2556 (iPhone 15/16 Pro)
- `iPad Pro 12.9": ` 2048×2732

Capture from the running app:

1. Open `ios/App/App.xcodeproj` in Xcode
2. Run on simulator (Product → Destination → ...)
3. Set up demo data: log in, create a sample project
4. Capture screens (Cmd+S in simulator):
   - Dashboard / project overview
   - Daily report form (with photo + voice icon visible)
   - Toolbox talk signature canvas
   - Safety incident screen
   - GPS clock-in screen
   - Project detail / RFI list
   - Settings / MFA setup
   - Billing / subscription management

Drop captured PNGs into the matching device folder. fastlane deliver
will upload them automatically.

For now, you can also upload them manually via App Store Connect →
CortexBuild → App Store tab → Screenshots.
