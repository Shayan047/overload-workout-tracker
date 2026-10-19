import type { QueryClient, QueryKey } from '@tanstack/react-query';

import type { KeyValueStorage } from './storage';

// The offline cache: query results marked `meta: { persist: true }` are saved on the phone
// and put back into TanStack Query when the app starts, so screens can show today's split,
// last-time data and recent stats without a connection.

export const CACHE_KEY = 'overload.cache.v1';

type Saved = Record<string, { queryKey: QueryKey; data: unknown; updatedAt: number }>;

export async function hydrateQueryCache(client: QueryClient, storage: KeyValueStorage): Promise<void> {
  let saved: Saved = {};
  try {
    saved = JSON.parse((await storage.getItem(CACHE_KEY)) ?? '{}') as Saved;
  } catch {
    saved = {};
  }
  for (const { queryKey, data, updatedAt } of Object.values(saved)) {
    client.setQueryData(queryKey, data, { updatedAt });
  }
}

/** Saves persisted queries whenever they change (batched). Returns a function to stop. */
export function persistQueryCache(client: QueryClient, storage: KeyValueStorage): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = () => {
    timer = null;
    const saved: Saved = {};
    for (const query of client.getQueryCache().getAll()) {
      if (query.meta?.persist && query.state.data !== undefined) {
        saved[query.queryHash] = {
          queryKey: query.queryKey,
          data: query.state.data,
          updatedAt: query.state.dataUpdatedAt,
        };
      }
    }
    void storage.setItem(CACHE_KEY, JSON.stringify(saved));
  };
  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.query.meta?.persist && !timer) {
      timer = setTimeout(save, 300);
    }
  });
  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
  };
}

export async function clearQueryCache(client: QueryClient, storage: KeyValueStorage): Promise<void> {
  client.clear();
  await storage.removeItem(CACHE_KEY);
}
