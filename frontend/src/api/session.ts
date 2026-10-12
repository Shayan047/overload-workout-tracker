import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { deviceStorage } from './storage';

export type User = { id: string; email: string; display_name: string | null };
export type Session = { token: string; user: User };

const TOKEN_KEY = 'overload.token';
const USER_KEY = 'overload.user';

// The token lives in the platform keychain/keystore. SecureStore has no web version; the
// web build is only used for review screenshots, so it falls back to localStorage there.
const tokenStore =
  Platform.OS === 'web'
    ? {
        get: async () => globalThis.localStorage?.getItem(TOKEN_KEY) ?? null,
        set: async (token: string) => globalThis.localStorage?.setItem(TOKEN_KEY, token),
        clear: async () => globalThis.localStorage?.removeItem(TOKEN_KEY),
      }
    : {
        get: () => SecureStore.getItemAsync(TOKEN_KEY),
        set: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
        clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
      };

/** The signed-in user, from the phone. Works offline: nothing is checked with the API. */
export async function loadSession(): Promise<Session | null> {
  const [token, user] = await Promise.all([tokenStore.get(), deviceStorage.getItem(USER_KEY)]);
  if (!token || !user) return null;
  try {
    return { token, user: JSON.parse(user) as User };
  } catch {
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  await Promise.all([
    tokenStore.set(session.token),
    deviceStorage.setItem(USER_KEY, JSON.stringify(session.user)),
  ]);
}

/** Forgets the token. The last user is kept, so signing back in as them keeps their
 * unsent writes (see AuthProvider). */
export async function forgetToken(): Promise<void> {
  await tokenStore.clear();
}

export async function lastUserId(): Promise<string | null> {
  try {
    return (JSON.parse((await deviceStorage.getItem(USER_KEY)) ?? 'null') as User | null)?.id ?? null;
  } catch {
    return null;
  }
}

export async function forgetUser(): Promise<void> {
  await deviceStorage.removeItem(USER_KEY);
}
