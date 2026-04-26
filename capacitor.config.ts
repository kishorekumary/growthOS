import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.exponentialai.growthos',
  appName: 'GrowthOS',
  webDir: 'out',

  server: {
    // Point to your live Vercel deployment so all API routes & server components work.
    // Replace this URL once you have a stable production domain.
    url: 'https://growthos.vercel.app',
    cleartext: false,
  },

  android: {
    buildOptions: {
      // Signing config — fill in after generating a keystore (see README below)
      // keystorePath: 'release.keystore',
      // keystoreAlias: 'growthos',
    },
    // Allow the WebView to follow http→https redirects (Supabase OAuth)
    allowMixedContent: false,
  },

  ios: {
    contentInset: 'always',
  },

  plugins: {
    // SplashScreen: hide automatically once the web app signals ready
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#020617',   // slate-950 — matches the app background
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
}

export default config
