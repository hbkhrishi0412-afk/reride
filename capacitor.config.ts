import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.reride.app',
  appName: 'ReRide',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#FF6B35",
      showSpinner: true,
      spinnerColor: "#FFFFFF"
    }
  },
  android: {
    buildOptions: {
      // Production keystore configuration
      // Set these environment variables for production builds:
      // ANDROID_KEYSTORE_PATH - path to your .jks or .keystore file
      // ANDROID_KEYSTORE_ALIAS - alias name for your key
      // ANDROID_KEYSTORE_PASSWORD - password for the keystore
      keystorePath: process.env.ANDROID_KEYSTORE_PATH || undefined,
      keystoreAlias: process.env.ANDROID_KEYSTORE_ALIAS || undefined,
      keystorePassword: process.env.ANDROID_KEYSTORE_PASSWORD || undefined,
      keystoreType: 'jks' // or 'pkcs12' for .p12 files
    }
  }
};

export default config;




