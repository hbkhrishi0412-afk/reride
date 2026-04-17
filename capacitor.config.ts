import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.reride.app',
  appName: 'ReRide',
  webDir: 'dist',
  server: {
    // https → WebView is a secure context; http://10.0.2.2 (local dev API) needs mixed-content
    // allowance in MainActivity.java. Do not switch to http here unless you accept non-HTTPS WebView.
    androidScheme: 'https'
  },
  plugins: {
    // Native Google: @capawesome/capacitor-google-sign-in + VITE_GOOGLE_WEB_CLIENT_ID at Vite build time.
    // Supabase: signInWithIdToken. GCP: Web client (this ID) + Android client (package + SHA-1) in same project.
    SplashScreen: {
      // 500 ms is too short on low-end Android devices — the WebView often hasn't
      // finished first paint by then, so users see a blank white flash. 1500 ms gives
      // the JS bundle time to hydrate before autoHide fires.
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#FFFFFF",
      showSpinner: true,
      spinnerColor: "#FF6B35",
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "large"
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




