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
  experiments: {
    typedRoutes: true,
  },
};

export default config;
