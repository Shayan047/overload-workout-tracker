import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';

import { isReviewMode } from '@/review/reviewMode';

import { useSync } from './AppProviders';

export type Settings = {
  unit: 'lb' | 'kg';
  active_split_id: string | null;
  ghost_mode: boolean;
  sync_wifi_only: boolean;
  rest_alert_sound: boolean;
};

/** What a new account starts with (the server's defaults). */
export const DEFAULT_SETTINGS: Settings = {
  unit: 'lb',
  active_split_id: null,
  ghost_mode: true,
  sync_wifi_only: true,
  rest_alert_sound: true,
};

export const SETTINGS_KEY = ['settings'] as const;

/** The body of PUT /settings: the whole object, nothing else. */
export function settingsBody(settings: Settings): Settings {
  const { unit, active_split_id, ghost_mode, sync_wifi_only, rest_alert_sound } = settings;
  return { unit, active_split_id, ghost_mode, sync_wifi_only, rest_alert_sound };
}

/** The user's settings, cached on the phone for offline use. While a settings change is
 * still waiting in the outbox, the local copy wins over what the server says. */
export function useSettings() {
  const { request, outbox } = useSync();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async () => {
      const server = await request<Settings>('GET', '/settings');
      const local = queryClient.getQueryData<Settings>(SETTINGS_KEY);
      return outbox.hasPending('/settings') && local ? local : server;
    },
    meta: { persist: true },
    enabled: !isReviewMode,
    initialData: isReviewMode ? DEFAULT_SETTINGS : undefined,
  });
}

/** Applies a settings change to the cache at once and returns the new settings. */
export function applySettings(queryClient: QueryClient, change: Partial<Settings>): Settings {
  const current = queryClient.getQueryData<Settings>(SETTINGS_KEY) ?? DEFAULT_SETTINGS;
  const next: Settings = { ...current, ...change };
  queryClient.setQueryData(SETTINGS_KEY, next);
  return next;
}

/** Changes settings: the screen updates at once, and the PUT goes through the outbox. */
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const { write } = useSync();
  return async (change: Partial<Settings>) => {
    const next = applySettings(queryClient, change);
    await write({ method: 'PUT', path: '/settings', body: settingsBody(next) });
  };
}
