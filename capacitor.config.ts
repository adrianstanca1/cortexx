import { CapacitorConfig } from '@capacitor/cli';

// NOTE: The iOS build's source of truth is ios/capacitor.config.ts. Keep appId
// here in sync with the real Xcode bundle id (app.cortexbuild.cortexx).
const config: CapacitorConfig = {
  appId: 'app.cortexbuild.cortexx',
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
