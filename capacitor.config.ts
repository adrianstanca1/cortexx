import { CapacitorConfig } from '@capacitor/cli';

// NOTE: The iOS build's source of truth is ios/capacitor.config.ts.
// Canonical bundle id across the repo is com.cortexbuild.app (see
// ios/capacitor.config.ts). Keep appId here in sync with that.
const config: CapacitorConfig = {
  appId: 'com.cortexbuild.app',
  appName: 'Cortexx',
  webDir: 'dist',
  server: {
    // For local dev against a live server, uncomment:
    // url: 'https://cortexbuildpro.com',
    // cleartext: false,
    androidScheme: 'https',
    iosScheme: 'https',
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#06101e',
    preferredContentMode: 'mobile',
  },
  android: {
    backgroundColor: '#06101e',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#06101e',
      showSpinner: false,
    },
  },
};

export default config;
