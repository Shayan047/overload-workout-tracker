import { type Connection, Outbox, type OutboxEntry, type SendResult } from '../outbox';
import type { KeyValueStorage } from '../storage';

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

const WIFI: Connection = { canSend: true, reason: 'ok' };
const OFFLINE: Connection = { canSend: false, reason: 'offline' };
const CELLULAR_WIFI_ONLY: Connection = { canSend: false, reason: 'needs-wifi' };

/** A fake server: records every request and answers with the scripted results. */
function fakeServer(script: (entry: OutboxEntry, call: number) => SendResult = () => ({ ok: true })) {
  const sent: OutboxEntry[] = [];
  return {
    sent,
    send: jest.fn(async (entry: OutboxEntry) => {
      sent.push(entry);
      return script(entry, sent.length);
    }),
  };
}

async function setup(options: { connection?: Connection; script?: Parameters<typeof fakeServer>[0] } = {}) {
  const storage = new MemoryStorage();
  const server = fakeServer(options.script);
  let connection = options.connection ?? OFFLINE;
  const timers: { fn: () => void; ms: number }[] = []; // pending retry timers
  const scheduled: number[] = []; // every delay ever asked for
  const outbox = await Outbox.open({
    storage,
    send: server.send,
    connection: () => connection,
    setTimer: (fn, ms) => {
      scheduled.push(ms);
      const timer = { fn, ms };
      timers.push(timer);
      return () => timers.splice(timers.indexOf(timer), 1);
    },
    log: () => {},
  });
  return {
    storage,
    server,
    outbox,
    timers,
    scheduled,
    setConnection(next: Connection) {
      connection = next;
    },
  };
}

const putSet = (n: number) => ({
  method: 'PUT' as const,
  path: `/sets/set-${n}`,
  body: { set_number: n, weight_kg: 9.072, reps: 7 },
});

describe('Outbox', () => {
  test('a write made offline is saved on the phone and not sent', async () => {
    const { outbox, server, storage } = await setup();

    await outbox.add(putSet(1));

    expect(server.send).not.toHaveBeenCalled();
    expect(outbox.status).toEqual({ pending: 1, state: 'offline', dropped: 0 });
    const stored = JSON.parse(storage.data.get('overload.outbox.v1')!);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ method: 'PUT', path: '/sets/set-1' });
  });

  test('it is sent once Wi-Fi returns, then the queue is empty', async () => {
    const { outbox, server, setConnection, storage } = await setup();
    await outbox.add(putSet(1));

    setConnection(WIFI);
    await outbox.flush();

    expect(server.sent.map((e) => e.path)).toEqual(['/sets/set-1']);
    expect(outbox.status).toEqual({ pending: 0, state: 'idle', dropped: 0 });
    expect(JSON.parse(storage.data.get('overload.outbox.v1')!)).toEqual([]);

    await outbox.flush();
    expect(server.send).toHaveBeenCalledTimes(1); // nothing is sent twice
  });

  test('on mobile data with "Sync on Wi-Fi only", it waits for Wi-Fi', async () => {
    const { outbox, server, setConnection } = await setup({ connection: CELLULAR_WIFI_ONLY });

    await outbox.add(putSet(1));
    expect(server.send).not.toHaveBeenCalled();
    expect(outbox.status.state).toBe('waiting-for-wifi');

    setConnection(WIFI);
    await outbox.flush();
    expect(server.send).toHaveBeenCalledTimes(1);
  });

  test('a write made online is sent right away', async () => {
    const { outbox, server } = await setup({ connection: WIFI });

    await outbox.add(putSet(1));
    await outbox.flush();

    expect(server.sent).toHaveLength(1);
  });

  test('entries go in order, one at a time', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const storage = new MemoryStorage();
    const sent: string[] = [];
    let connection = OFFLINE;
    const outbox = await Outbox.open({
      storage,
      connection: () => connection,
      setTimer: () => () => {},
      log: () => {},
      send: async (entry) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        sent.push(entry.path);
        inFlight -= 1;
        return { ok: true };
      },
    });
    for (let n = 1; n <= 5; n += 1) await outbox.add(putSet(n));

    // Several triggers at once (network event, app foreground, new write) share one run.
    connection = WIFI;
    await Promise.all([outbox.flush(), outbox.flush(), outbox.flush()]);

    expect(sent).toEqual(['/sets/set-1', '/sets/set-2', '/sets/set-3', '/sets/set-4', '/sets/set-5']);
    expect(maxInFlight).toBe(1);
  });

  test('a write added while sending is sent in the same run, after the others', async () => {
    const { outbox, server } = await setup({
      connection: WIFI,
      script: (entry, call) => {
        if (call === 1) void outbox.add(putSet(2));
        return { ok: true };
      },
    });

    await outbox.add(putSet(1));
    await outbox.flush();

    expect(server.sent.map((e) => e.path)).toEqual(['/sets/set-1', '/sets/set-2']);
    expect(outbox.status.pending).toBe(0);
  });

  test('the queue survives an app restart', async () => {
    const first = await setup();
    await first.outbox.add(putSet(1));
    await first.outbox.add(putSet(2));

    const server = fakeServer();
    const reopened = await Outbox.open({
      storage: first.storage,
      send: server.send,
      connection: () => WIFI,
      setTimer: () => () => {},
      log: () => {},
    });
    expect(reopened.status.pending).toBe(2);
    await reopened.flush();

    expect(server.sent.map((e) => e.path)).toEqual(['/sets/set-1', '/sets/set-2']);
  });

  test('a lost response means the same request is sent again', async () => {
    const { outbox, server, timers } = await setup({
      connection: WIFI,
      // The server applied the first attempt, but the phone never saw the answer.
      script: (_, call) => (call === 1 ? { ok: false, kind: 'network' } : { ok: true }),
    });

    await outbox.add(putSet(1));
    await outbox.flush();
    expect(outbox.status).toMatchObject({ pending: 1, state: 'retrying' });

    timers[0].fn();
    await outbox.flush();

    expect(server.sent.map((e) => e.path)).toEqual(['/sets/set-1', '/sets/set-1']);
    expect(server.sent[0]).toEqual(server.sent[1]); // identical, so the server treats it as a replay
    expect(outbox.status.pending).toBe(0);
  });

  test('server errors keep the order and back off', async () => {
    let failing = true;
    const { outbox, server, timers, scheduled } = await setup({
      connection: WIFI,
      script: () => (failing ? { ok: false, kind: 'http', status: 503 } : { ok: true }),
    });
    await outbox.add(putSet(1));
    await outbox.add(putSet(2));

    await outbox.flush();
    await outbox.flush();
    await outbox.flush();

    // Never skips ahead to set 2 while set 1 is failing.
    expect(new Set(server.sent.map((e) => e.path))).toEqual(new Set(['/sets/set-1']));
    expect(scheduled[1]).toBeGreaterThan(scheduled[0]);
    expect(scheduled[2]).toBeGreaterThan(scheduled[1]);
    expect(timers).toHaveLength(1); // a newer retry replaces the older one

    failing = false;
    await outbox.flush();
    expect(server.sent.slice(-2).map((e) => e.path)).toEqual(['/sets/set-1', '/sets/set-2']);
  });

  test('a 401 pauses everything until the user signs in again', async () => {
    let signedIn = false;
    const { outbox, server } = await setup({
      connection: WIFI,
      script: () => (signedIn ? { ok: true } : { ok: false, kind: 'http', status: 401 }),
    });
    await outbox.add(putSet(1));
    await outbox.add(putSet(2));

    await outbox.flush();
    expect(outbox.status).toMatchObject({ pending: 2, state: 'signed-out' });
    await outbox.flush();
    expect(server.send).toHaveBeenCalledTimes(1);

    signedIn = true;
    await outbox.resume();
    expect(server.sent.slice(1).map((e) => e.path)).toEqual(['/sets/set-1', '/sets/set-2']);
    expect(outbox.status.pending).toBe(0);
  });

  test('other 4xx responses can never succeed, so the entry is dropped', async () => {
    const { outbox, server } = await setup({
      connection: WIFI,
      script: (entry) => (entry.path === '/sets/set-1' ? { ok: false, kind: 'http', status: 422 } : { ok: true }),
    });
    await outbox.add(putSet(1));
    await outbox.add(putSet(2));

    await outbox.flush();

    expect(server.sent.map((e) => e.path)).toEqual(['/sets/set-1', '/sets/set-2']);
    expect(outbox.status).toEqual({ pending: 0, state: 'idle', dropped: 1 });
  });

  test('408 and 429 are retried, not dropped', async () => {
    for (const status of [408, 429]) {
      const { outbox } = await setup({ connection: WIFI, script: () => ({ ok: false, kind: 'http', status }) });
      await outbox.add(putSet(1));
      await outbox.flush();
      expect(outbox.status).toMatchObject({ pending: 1, state: 'retrying' });
    }
  });

  test('going offline stops sending until the connection is back', async () => {
    const { outbox, server, setConnection } = await setup({
      connection: WIFI,
      script: (_, call) => {
        if (call === 1) setConnection(OFFLINE);
        return { ok: true };
      },
    });
    await outbox.add(putSet(1));
    await outbox.add(putSet(2));

    await outbox.flush();

    expect(server.sent).toHaveLength(1);
    expect(outbox.status).toMatchObject({ pending: 1, state: 'offline' });
  });

  test('subscribers hear about every status change', async () => {
    const { outbox, setConnection } = await setup();
    const seen: string[] = [];
    const unsubscribe = outbox.subscribe((status) => seen.push(`${status.state}:${status.pending}`));

    await outbox.add(putSet(1));
    setConnection(WIFI);
    await outbox.flush();
    unsubscribe();
    await outbox.add(putSet(2));

    expect(seen).toEqual(['offline:1', 'sending:1', 'idle:0']);
  });

  test('hasPending tells reads a local change is still unsent', async () => {
    const { outbox, setConnection } = await setup();
    await outbox.add({ method: 'PUT', path: '/settings', body: { unit: 'kg' } });

    expect(outbox.hasPending('/settings')).toBe(true);
    expect(outbox.hasPending('/sets/set-1')).toBe(false);

    setConnection(WIFI);
    await outbox.flush();
    expect(outbox.hasPending('/settings')).toBe(false);
  });

  test('clear() forgets everything, for signing out', async () => {
    const { outbox, storage } = await setup();
    await outbox.add(putSet(1));

    await outbox.clear();

    expect(outbox.status).toEqual({ pending: 0, state: 'idle', dropped: 0 });
    expect(JSON.parse(storage.data.get('overload.outbox.v1')!)).toEqual([]);
  });

  test('a corrupt saved queue starts empty instead of crashing', async () => {
    const storage = new MemoryStorage();
    storage.data.set('overload.outbox.v1', '{not json');
    const outbox = await Outbox.open({
      storage,
      send: async () => ({ ok: true }),
      connection: () => WIFI,
      setTimer: () => () => {},
      log: () => {},
    });
    expect(outbox.status.pending).toBe(0);
  });
});
