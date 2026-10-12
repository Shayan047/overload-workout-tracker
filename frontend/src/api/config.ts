import Constants from 'expo-constants';

/**
 * Where the API lives. Set EXPO_PUBLIC_API_URL to override. In development the default is
 * port 8000 on the computer running the Expo dev server, so a phone on the same Wi-Fi
 * reaches the backend from `docker compose up` without any setup.
 */
function defaultApiUrl(): string {
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${devHost ?? 'localhost'}:8000`;
}

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? defaultApiUrl()).replace(/\/$/, '');

/** A request that takes longer than this counts as "no response" and is retried later. */
export const REQUEST_TIMEOUT_MS = 15_000;
