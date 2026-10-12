import { useQuery, useQueryClient } from '@tanstack/react-query';

import { isReviewMode } from '@/review/reviewMode';

import { useSync } from './AppProviders';

export type Settings = {
  unit: 'lb' | 'kg';
  active_split_id: string | null;
  ghost_mode: boolean;
  sync_wifi_only: boolean;
  rest_alert_sound: boolean;
};

const REVIEW_SETTINGS: Settings = {
  unit: 'lb',
  active_split_id: null,
  ghost_mode: true,
  sync_wifi_only: true,
  rest_alert_sound: true,
};

/** The user's settings, cached on the phone for offline use. */
export function useSettings() {
  const { request } = useSync();
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => request<Settings>('GET', '/settings'),
    meta: { persist: true },
    enabled: !isReviewMode,
    initialData: isReviewMode ? REVIEW_SETTINGS : undefined,
  });
}

/** Changes settings: the screen updates at once, and the PUT goes through the outbox. */
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const { write } = useSync();
  return async (change: Partial<Settings>) => {
    const current = queryClient.getQueryData<Settings>(['settings']);
    if (!current) throw new Error('Settings are not loaded yet');
    const next: Settings = { ...current, ...change };
    queryClient.setQueryData(['settings'], next);
    await write({
      method: 'PUT',
      path: '/settings',
      body: {
        unit: next.unit,
        active_split_id: next.active_split_id,
        ghost_mode: next.ghost_mode,
        sync_wifi_only: next.sync_wifi_only,
        rest_alert_sound: next.rest_alert_sound,
      },
    });
  };
}
