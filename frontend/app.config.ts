import type { ExpoConfig } from 'expo/config';

import tokens from '../design/tokens.json';

// A config file rather than app.json, so native background colors come from the tokens.
const config: ExpoConfig = {
  name: 'Overload',
  slug: 'overload',
  scheme: 'overload',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: tokens.color.bg,
  ios: {
    supportsTablet: false,
  },
  android: {
    // Permanent: an APK only installs over an earlier one with the same package.
    package: 'com.shayan047.overload',
    adaptiveIcon: {
      backgroundColor: tokens.color.bg,
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    // Used only for review screenshots (see scripts/screenshot.mjs).
    bundler: 'metro',
    output: 'single',
    favicon: './assets/favicon.png',
  },
  plugins: ['expo-router', 'expo-font', 'expo-notifications'],
  // The EAS project (@shayan47/overload) that builds the APK; see "Building the APK" in
  // CLAUDE.md.
  owner: 'shayan47',
  extra: {
    eas: { projectId: '2ea70358-e073-4913-a86d-5a06a87f472b' },
  },
  experiments: {
    typedRoutes: true,
  },
};

export default config;
