import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cortexbuild.app',
  appName: 'Cortexx',
  webDir: '.',
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
