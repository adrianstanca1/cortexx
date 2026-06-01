import { CapacitorConfig } from '@capacitor/cli';

// CAPACITOR_SERVER_URL toggles the two distribution modes:
//   - unset  → offline bundle. webDir = www/ (legacy static PWA copied by
//              scripts/build-web.mjs). Works on aeroplane, no backend.
//   - set    → cloud mode. WKWebView loads `${URL}` on every launch and the
//              full Next.js backend (auth, Postgres, SSE, Ollama, whisper.cpp,
//              PDF endpoints) runs server-side. Recommended for TestFlight.
//
// Example for TestFlight:
//   CAPACITOR_SERVER_URL=https://cortexbuildpro.com npm run build:web
const SERVER_URL = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  // App ID — reverse-DNS format. Change to your registered Apple bundle id.
  appId: 'com.cortexbuild.app',

  // Display name shown under the icon on the home screen.
  appName: 'Cortexx',

  // Capacitor expects a single index.html in webDir. We rename Cortexx.html
  // → index.html during build:web (see scripts/build-web.mjs).
  webDir: 'www',

  ...(SERVER_URL ? {
    server: {
      url: SERVER_URL,
      // Allow http:// for local dev boxes; https:// production stays secure.
      cleartext: SERVER_URL.startsWith('http://'),
    },
  } : {}),

  ios: {
    contentInset: 'always',
    scrollEnabled: true,
    // Stop the WKWebView from showing a bounce halo that conflicts with our sheets.
    overrideUserAgent: undefined,
    // Limits which schemes can be invoked from JS (mailto:, tel:, sms:).
    limitsNavigationsToAppBoundDomains: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#06101e',
      androidSplashResourceName: 'splash',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#06101e',
      overlaysWebView: true,
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#2563eb',
    },
  },
};

export default config;
