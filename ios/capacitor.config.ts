import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Registered App Store bundle identifier.
  appId: 'com.cortexbuild.app',

  // Display name shown under the icon on the home screen.
  appName: 'Cortexx',

  // Capacitor expects a single index.html in webDir. We rename Cortexx.html
  // → index.html during build:web (see scripts/build-web.mjs).
  webDir: 'www',

  // For the live-reload dev loop, point at the served URL of your dev box.
  // Leave commented out for production builds — the bundle ships offline.
  // server: { url: 'http://192.168.1.50:5500', cleartext: true },

  ios: {
    // Capacitor root is ios/ — use '.' so native project lands at ios/App/, not ios/ios/App/.
    path: '.',
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
