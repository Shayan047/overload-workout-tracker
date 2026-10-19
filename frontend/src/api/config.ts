import Constants from 'expo-constants';

/** The deployed API (Render free, Ohio; see ../render.yaml). */
export const PRODUCTION_API_URL = 'https://overload-api-tmv6.onrender.com';

/**
 * Where the API lives. EXPO_PUBLIC_API_URL overrides it. Release builds (the APK) use the
 * deployed API. In development the default is port 8000 on the computer running the Expo
 * dev server, so a phone on the same Wi-Fi reaches the backend from `docker compose up`
 * without any setup.
 */
function defaultApiUrl(): string {
  if (!__DEV__) return PRODUCTION_API_URL;
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${devHost ?? 'localhost'}:8000`;
}

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? defaultApiUrl()).replace(/\/$/, '');

/**
 * A request that takes longer than this counts as "no response" and is retried later.
 * Render's free plan sleeps after 15 minutes idle and takes about a minute to wake, so the
 * first request after a break must be allowed to wait that long. With no connection at all,
 * requests fail at once instead.
 */
export const REQUEST_TIMEOUT_MS = 75_000;

/** How long a sign-in or sign-up runs before the button says the server is waking up. */
export const WAKING_HINT_MS = 5_000;
