/// <reference types="node" />
/**
 * End to end against a running API: a session logged offline is saved on the phone, sent
 * once Wi-Fi returns, and replaying the whole outbox afterwards changes nothing.
 *
 *   E2E_API_URL=http://localhost:8000 npx jest outbox.e2e
 *
 * Skipped unless E2E_API_URL is set. It signs up a throwaway e2e-…@example.com user.
 */
import { createHash, randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';

import { sendEntry } from '../http';
import { syncStatusText } from '../network';
import { type Connection, Outbox, OUTBOX_KEY } from '../outbox';
import type { KeyValueStorage } from '../storage';

const API = process.env.E2E_API_URL;

jest.mock('../config', () => ({ API_URL: process.env.E2E_API_URL, REQUEST_TIMEOUT_MS: 15_000 }));
jest.mock('@/lib/ids', () => ({ newId: () => require('node:crypto').randomUUID() }));

/**
 * Under jest-expo, `fetch` is Expo's native fetch, which doesn't work in Node. This is just
 * enough real HTTP for the app's own `sendEntry` and this test to talk to the API.
 */
function nodeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      url,
      { method: init.method ?? 'GET', headers: init.headers as Record<string, string> },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          const status = res.statusCode ?? 0;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            json: async () => JSON.parse(text),
            text: async () => text,
          } as Response);
        });
      },
    );
    req.on('error', reject);
    init.signal?.addEventListener('abort', () => req.destroy(new Error('aborted')));
    if (typeof init.body === 'string') req.write(init.body);
    req.end();
  });
}
globalThis.fetch = nodeFetch as typeof fetch;

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>();
  async getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  async removeItem(key: string) {
    this.data.delete(key);
  }
}

/** Python's uuid.uuid5, for the library's exercise ids. */
function uuid5(namespace: string, name: string): string {
  const hash = createHash('sha1')
    .update(Buffer.from(namespace.replace(/-/g, ''), 'hex'))
    .update(name)
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const LIBRARY = 'ed460aec-d1a3-42ee-92bc-8f3a717ad3ee';
const CURL = uuid5(LIBRARY, 'free-exercise-db:Dumbbell_Bicep_Curl');
const LB = 0.45359237;

/** Drops every `updated_at`, at any depth. */
function withoutUpdatedAt(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutUpdatedAt);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'updated_at')
        .map(([key, inner]) => [key, withoutUpdatedAt(inner)]),
    );
  }
  return value;
}

const OFFLINE: Connection = { canSend: false, reason: 'offline' };
const WIFI: Connection = { canSend: true, reason: 'ok' };

const describeE2E = API ? describe : describe.skip;

describeE2E('outbox against the real API', () => {
  let token: string;

  async function get(path: string) {
    const response = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(response.status).toBe(200);
    return response.json();
  }

  beforeAll(async () => {
    const response = await fetch(`${API}/auth/sign-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `e2e-${randomUUID()}@example.com`, password: 'correct horse' }),
    });
    expect(response.status).toBe(201);
    token = (await response.json()).access_token;
  });

  async function openOutbox(storage: KeyValueStorage, connection: { current: Connection }) {
    return Outbox.open({
      storage,
      send: (entry) => sendEntry(entry, token),
      connection: () => connection.current,
      setTimer: () => () => {},
      log: () => {},
    });
  }

  test('offline session: saved on the phone, sent on Wi-Fi, replay changes nothing', async () => {
    const storage = new MemoryStorage();
    const connection = { current: OFFLINE };
    const outbox = await openOutbox(storage, connection);

    // A whole session, made in airplane mode.
    const splitId = randomUUID();
    const workoutId = randomUUID();
    const rowId = randomUUID();
    await outbox.add({ method: 'POST', path: `/splits/${splitId}/from-preset`, body: { preset: 'arnold' } });
    await outbox.add({
      method: 'PUT',
      path: `/bodyweight-entries/${randomUUID()}`,
      body: { weight_kg: 172 * LB, measured_on: '2026-10-09' },
    });
    await outbox.add({
      method: 'PUT',
      path: `/workouts/${workoutId}`,
      body: {
        split_day_id: uuid5(splitId, 'day:1'),
        title: 'Shoulders & Arms',
        started_at: '2026-10-09T18:12:00Z',
      },
    });
    await outbox.add({
      method: 'PUT',
      path: `/workout-exercises/${rowId}`,
      body: { workout_id: workoutId, exercise_id: CURL, position: 2, rest_seconds: 90 },
    });
    for (const [number, reps] of [7, 6, 6, 5].entries()) {
      await outbox.add({
        method: 'PUT',
        path: `/sets/${randomUUID()}`,
        body: {
          workout_exercise_id: rowId,
          set_number: number + 1,
          weight_kg: 20 * LB,
          reps,
          logged_at: `2026-10-09T18:2${number}:00Z`,
        },
      });
    }
    await outbox.add({
      method: 'PUT',
      path: `/workout-exercises/${rowId}`,
      body: { workout_id: workoutId, exercise_id: CURL, position: 2, status: 'done', rest_seconds: 90 },
    });
    await outbox.add({
      method: 'PUT',
      path: `/workouts/${workoutId}`,
      body: {
        split_day_id: uuid5(splitId, 'day:1'),
        title: 'Shoulders & Arms',
        started_at: '2026-10-09T18:12:00Z',
        ended_at: '2026-10-09T18:59:00Z',
      },
    });
    await outbox.add({
      method: 'PUT',
      path: '/settings',
      body: {
        unit: 'lb',
        active_split_id: splitId,
        ghost_mode: false,
        sync_wifi_only: true,
        rest_alert_sound: true,
      },
    });

    // Airplane mode: everything is on the phone, nothing reached the server.
    expect(outbox.status).toMatchObject({ pending: 11, state: 'offline' });
    expect(syncStatusText(outbox.status)).toBe('Saved on this phone');
    const savedQueue = storage.data.get(OUTBOX_KEY)!;
    expect((await get('/workouts')).length).toBe(0);

    // Wi-Fi is back: it all goes, in order, once.
    connection.current = WIFI;
    await outbox.flush();
    expect(outbox.status).toEqual({ pending: 0, state: 'idle', dropped: 0 });
    expect(syncStatusText(outbox.status)).toBeNull();

    const snapshot = async () => ({
      workout: await get(`/workouts/${workoutId}`),
      split: await get(`/splits/${splitId}`),
      bodyweight: await get('/bodyweight-entries'),
      settings: await get('/settings'),
    });
    const before = await snapshot();
    expect(before.workout.ended_at).toBe('2026-10-09T18:59:00Z');
    expect(before.workout.bodyweight_kg).toBe(78.018); // snapshot from the entry sent first
    expect(before.workout.exercises[0].sets.map((s: { reps: number }) => s.reps)).toEqual([7, 6, 6, 5]);
    expect(before.workout.exercises[0].status).toBe('done');
    expect(before.settings.active_split_id).toBe(splitId);

    // Replay the whole outbox, twice, as if the phone had never seen any response.
    for (let replay = 0; replay < 2; replay += 1) {
      const copy = new MemoryStorage();
      copy.data.set(OUTBOX_KEY, savedQueue);
      const again = await openOutbox(copy, { current: WIFI });
      expect(again.status.pending).toBe(11);
      await again.flush();
      expect(again.status).toEqual({ pending: 0, state: 'idle', dropped: 0 });
    }

    // Same data as before. (A replayed request on its own rewrites nothing, not even
    // updated_at; see outbox.test.ts and the backend's replay test. Replaying the *whole*
    // queue re-sends the curl row's "planned" PUT before its "done" one, so that row passes
    // through "planned" and back: its values end up the same, its updated_at moves.)
    expect(withoutUpdatedAt(await snapshot())).toEqual(withoutUpdatedAt(before));
  }, 60_000);
});
