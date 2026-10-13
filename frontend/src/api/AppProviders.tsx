import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';

import { isReviewMode } from '@/review/reviewMode';

import { clearQueryCache, hydrateQueryCache, persistQueryCache } from './cache';
import { apiRequest, sendEntry } from './http';
import { connectionFor, type NetworkState } from './network';
import { Outbox, type OutboxEntry, type OutboxStatus } from './outbox';
import {
  forgetToken,
  forgetUser,
  lastUserId,
  loadSession,
  saveSession,
  type Session,
  type User,
} from './session';
import type { Settings } from './settings';
import { deviceStorage } from './storage';

type Services = {
  queryClient: QueryClient;
  outbox: Outbox;
  session: Session | null;
  /** The token the outbox and queries send; updated on sign-in and sign-out. */
  token: { current: string | null };
};

/** Loads everything the app needs from the phone before the first screen renders. */
async function startServices(): Promise<Services> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, gcTime: 24 * 60 * 60 * 1000, retry: 1 } },
  });
  await hydrateQueryCache(queryClient, deviceStorage);
  persistQueryCache(queryClient, deviceStorage);

  const session = await loadSession();
  const token = { current: session?.token ?? null };
  let network: NetworkState = { type: 'unknown', isConnected: null, isInternetReachable: null };
  const syncWifiOnly = () =>
    // The web build is only for review screenshots and has no Wi-Fi information.
    Platform.OS !== 'web' && (queryClient.getQueryData<Settings>(['settings'])?.sync_wifi_only ?? true);

  const outbox = await Outbox.open({
    storage: deviceStorage,
    // No account yet (onboarding queues writes before sign-up): wait as if signed out,
    // without sending anything. Signing up resumes the outbox.
    send: (entry) =>
      token.current
        ? sendEntry(entry, token.current)
        : Promise.resolve({ ok: false, kind: 'http', status: 401 } as const),
    connection: () => connectionFor(network, syncWifiOnly()),
    setTimer: (fn, ms) => {
      const timer = setTimeout(fn, ms);
      return () => clearTimeout(timer);
    },
    log: (message, entry) => console.warn(message, entry.method, entry.path),
  });

  if (!isReviewMode) {
    // Every network change (e.g. airplane mode off, Wi-Fi back) and every return to the
    // foreground gives the outbox a chance to send.
    NetInfo.addEventListener((state) => {
      network = state;
      void outbox.flush();
    });
    AppState.addEventListener('change', (state) => {
      if (state === 'active') void outbox.flush();
    });
    onlineManager.setEventListener((setOnline) =>
      NetInfo.addEventListener((state) => setOnline(!!state.isConnected)),
    );
    // Coming back to the app refreshes data that has gone stale (TanStack Query's
    // "window focus" for React Native).
    if (Platform.OS !== 'web') {
      focusManager.setEventListener((setFocused) => {
        const subscription = AppState.addEventListener('change', (state) => setFocused(state === 'active'));
        return () => subscription.remove();
      });
    }
  }
  return { queryClient, outbox, session, token };
}

type AuthValue = {
  user: User | null;
  signedIn: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string | null) => Promise<void>;
  signOut: () => Promise<void>;
  /** "Get started": a new account begins. Clears any previous user's data on the phone
   * first, so onboarding writes (queued before the account exists) are never mixed up with
   * someone else's. */
  beginOnboarding: () => Promise<void>;
};

type SyncValue = {
  status: OutboxStatus;
  outbox: Outbox;
  /** Saves a write on the phone; it's sent when the connection rules allow. */
  write: (entry: Pick<OutboxEntry, 'method' | 'path' | 'body'>) => Promise<OutboxEntry>;
  /** For direct reads with the current token. */
  request: <T>(method: string, path: string, body?: unknown) => Promise<T>;
};

const AuthContext = createContext<AuthValue | null>(null);
const SyncContext = createContext<SyncValue | null>(null);

const REVIEW_USER: User = { id: 'review', email: 'shayan@example.com', display_name: 'Shayan' };
// Today (07) shows "1 waiting for Wi-Fi".
const REVIEW_STATUS: OutboxStatus = { pending: 1, state: 'waiting-for-wifi', dropped: 0 };

type TokenResponse = { access_token: string; user: User };

export function AppProviders({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [services, setServices] = useState<Services | null>(null);
  useEffect(() => {
    void startServices().then(setServices);
  }, []);
  if (!services) return <>{fallback}</>;
  return (
    <QueryClientProvider client={services.queryClient}>
      <Providers services={services}>{children}</Providers>
    </QueryClientProvider>
  );
}

function Providers({ services, children }: { services: Services; children: ReactNode }) {
  const { outbox, queryClient, token } = services;
  const [user, setUser] = useState<User | null>(services.session?.user ?? null);
  const [status, setStatus] = useState(outbox.status);
  const signedInRef = useRef(user !== null);
  signedInRef.current = user !== null;

  const startSession = useCallback(
    async (response: TokenResponse) => {
      const previous = await lastUserId();
      if (previous && previous !== response.user.id) {
        // Someone else's unsent writes and cached data must never reach this account.
        await outbox.clear();
        await clearQueryCache(queryClient, deviceStorage);
      }
      await saveSession({ token: response.access_token, user: response.user });
      token.current = response.access_token;
      setUser(response.user);
      await outbox.resume();
    },
    [outbox, queryClient, token],
  );

  const endSession = useCallback(async () => {
    await forgetToken();
    token.current = null;
    setUser(null);
  }, [token]);

  useEffect(
    () =>
      outbox.subscribe((next) => {
        setStatus(next);
        // A 401 means the token expired or was revoked: ask the user to sign in again.
        // Their unsent writes stay and go out once they're back.
        if (next.state === 'signed-out' && signedInRef.current) void endSession();
      }),
    [outbox, endSession],
  );

  const auth = useMemo<AuthValue>(
    () => ({
      user: isReviewMode ? REVIEW_USER : user,
      signedIn: isReviewMode || user !== null,
      signIn: async (email, password) =>
        startSession(await apiRequest('POST', '/auth/sign-in', { body: { email, password } })),
      signUp: async (email, password, displayName) =>
        startSession(
          await apiRequest('POST', '/auth/sign-up', {
            body: { email, password, display_name: displayName },
          }),
        ),
      signOut: async () => {
        await outbox.clear();
        await clearQueryCache(queryClient, deviceStorage);
        await forgetUser();
        await endSession();
      },
      beginOnboarding: async () => {
        if (!(await lastUserId())) return;
        await outbox.clear();
        await clearQueryCache(queryClient, deviceStorage);
        await forgetUser();
      },
    }),
    [user, startSession, endSession, outbox, queryClient],
  );

  const sync = useMemo<SyncValue>(
    () => ({
      status: isReviewMode ? REVIEW_STATUS : status,
      outbox,
      write: (entry) => outbox.add(entry),
      request: (method, path, body) => apiRequest(method, path, { body, token: token.current }),
    }),
    [status, outbox, token],
  );

  return (
    <AuthContext.Provider value={auth}>
      <SyncContext.Provider value={sync}>{children}</SyncContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AppProviders');
  return value;
}

export function useSync(): SyncValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used inside AppProviders');
  return value;
}
