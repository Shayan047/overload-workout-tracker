// The outbox: every write the app makes, saved on the phone and sent to the API in order
// when the connection rules allow. See "IDs and writes" in docs/api-and-sync.md.
//
// - add() saves the write before it returns, so it survives the app being killed.
// - One run at a time sends the oldest entry first and waits for its response.
// - An entry is removed only after its response arrives. If the response is lost, the same
//   request is sent again; the API's PUTs are idempotent, so that's harmless.
// - 2xx: done. 401: pause until the user signs in again. 408, 429, 5xx or no response: retry
//   later with backoff, without skipping ahead. Other 4xx: can never succeed, drop it.

import { newId } from '@/lib/ids';

import type { KeyValueStorage } from './storage';

export const OUTBOX_KEY = 'overload.outbox.v1';

/** Retry delays after a failure, by attempt; the last one repeats. */
export const BACKOFF_MS = [2_000, 5_000, 15_000, 30_000, 60_000, 120_000, 300_000];

export type OutboxEntry = {
  id: string;
  method: 'PUT' | 'POST' | 'DELETE';
  path: string;
  body?: unknown;
  createdAt: string;
};

export type SendResult =
  | { ok: true }
  | { ok: false; kind: 'network' }
  | { ok: false; kind: 'http'; status: number };

/** Whether writes may be sent right now, and if not, why. See network.ts. */
export type Connection = { canSend: boolean; reason: 'ok' | 'offline' | 'needs-wifi' };

export type OutboxState =
  | 'idle' // nothing waiting
  | 'sending'
  | 'offline'
  | 'waiting-for-wifi'
  | 'retrying' // the last attempt failed; a retry is scheduled
  | 'signed-out'; // the API said 401; waiting for sign-in

export type OutboxStatus = { pending: number; state: OutboxState; dropped: number };

export type OutboxDeps = {
  storage: KeyValueStorage;
  send: (entry: OutboxEntry) => Promise<SendResult>;
  connection: () => Connection;
  /** Schedules `fn` after `ms`; returns a function that cancels it. */
  setTimer: (fn: () => void, ms: number) => () => void;
  log?: (message: string, entry: OutboxEntry) => void;
  makeId?: () => string;
};

type Listener = (status: OutboxStatus) => void;

function isEntry(value: unknown): value is OutboxEntry {
  const entry = value as OutboxEntry;
  return (
    typeof entry === 'object' &&
    entry !== null &&
    typeof entry.id === 'string' &&
    typeof entry.path === 'string' &&
    ['PUT', 'POST', 'DELETE'].includes(entry.method)
  );
}

function retryable(result: Exclude<SendResult, { ok: true }>): boolean {
  if (result.kind === 'network') return true;
  return result.status >= 500 || result.status === 408 || result.status === 429;
}

export class Outbox {
  private queue: OutboxEntry[];
  private state: OutboxState = 'idle';
  private dropped = 0;
  private paused = false;
  private attempt = 0;
  private cancelRetry: (() => void) | null = null;
  private running: Promise<void> | null = null;
  private runAgain = false;
  private saving: Promise<void> = Promise.resolve();
  private listeners = new Set<Listener>();
  private lastEmitted = '';

  private constructor(
    private deps: OutboxDeps,
    queue: OutboxEntry[],
  ) {
    this.queue = queue;
    this.state = queue.length ? this.waitingState() : 'idle';
  }

  /** Loads the saved queue. A missing or unreadable one starts empty. */
  static async open(deps: OutboxDeps): Promise<Outbox> {
    let queue: OutboxEntry[] = [];
    try {
      const saved = JSON.parse((await deps.storage.getItem(OUTBOX_KEY)) ?? '[]');
      if (Array.isArray(saved)) queue = saved.filter(isEntry);
    } catch {
      queue = [];
    }
    return new Outbox(deps, queue);
  }

  get status(): OutboxStatus {
    return { pending: this.queue.length, state: this.state, dropped: this.dropped };
  }

  get entries(): readonly OutboxEntry[] {
    return this.queue;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Saves a write. Resolves once it's stored on the phone; sending happens afterwards. */
  async add(write: Pick<OutboxEntry, 'method' | 'path' | 'body'>): Promise<OutboxEntry> {
    const entry: OutboxEntry = {
      id: (this.deps.makeId ?? newId)(),
      createdAt: new Date().toISOString(),
      ...write,
    };
    this.queue.push(entry);
    await this.save();
    if (!this.running) this.setState(this.waitingState());
    void this.flush();
    return entry;
  }

  /** Sends what it can. Concurrent calls share one run; a call during a run makes it go on. */
  flush(): Promise<void> {
    if (this.running) {
      this.runAgain = true;
      return this.running;
    }
    this.running = this.run();
    return this.running;
  }

  private async run(): Promise<void> {
    try {
      do {
        this.runAgain = false;
        await this.drain();
        // A request that arrived mid-run gets another pass, unless the run stopped to back
        // off or to wait for sign-in: those resume on their timer or on resume().
      } while (this.runAgain && this.state !== 'retrying' && !this.paused);
    } finally {
      // Cleared in the same step as the last check above, so a flush() can never join a
      // run that has already decided to stop.
      this.running = null;
    }
  }

  /** After signing in again: continue where a 401 stopped. */
  async resume(): Promise<void> {
    this.paused = false;
    this.attempt = 0;
    await this.flush();
  }

  /** Forgets every waiting write (signing out, or another user signing in). */
  async clear(): Promise<void> {
    this.queue = [];
    this.dropped = 0;
    this.paused = false;
    this.attempt = 0;
    this.cancelRetry?.();
    this.cancelRetry = null;
    await this.save();
    this.setState('idle');
  }

  private async drain(): Promise<void> {
    this.cancelRetry?.();
    this.cancelRetry = null;
    while (this.queue.length) {
      if (this.paused) return this.setState('signed-out');
      const connection = this.deps.connection();
      if (!connection.canSend) return this.setState(this.waitingState(connection));

      const entry = this.queue[0];
      this.setState('sending');
      const result = await this.deps.send(entry);

      if (result.ok) {
        this.attempt = 0;
        await this.remove(entry.id);
      } else if (result.kind === 'http' && result.status === 401) {
        this.paused = true;
        return this.setState('signed-out');
      } else if (retryable(result)) {
        const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)];
        this.attempt += 1;
        this.cancelRetry = this.deps.setTimer(() => void this.flush(), delay);
        return this.setState('retrying');
      } else if (result.kind === 'http') {
        this.dropped += 1;
        this.deps.log?.(`Dropped a write the API rejected (${result.status})`, entry);
        await this.remove(entry.id);
      }
    }
    this.setState('idle');
  }

  private waitingState(connection = this.deps.connection()): OutboxState {
    if (!this.queue.length) return 'idle';
    if (this.paused) return 'signed-out';
    if (connection.reason === 'offline') return 'offline';
    if (connection.reason === 'needs-wifi') return 'waiting-for-wifi';
    return 'sending';
  }

  private async remove(id: string): Promise<void> {
    this.queue = this.queue.filter((entry) => entry.id !== id);
    await this.save();
  }

  /** Writes the queue in call order, so an older snapshot never overwrites a newer one. */
  private save(): Promise<void> {
    const snapshot = JSON.stringify(this.queue);
    this.saving = this.saving.then(() => this.deps.storage.setItem(OUTBOX_KEY, snapshot));
    return this.saving;
  }

  private setState(state: OutboxState): void {
    this.state = state;
    const status = this.status;
    const key = `${status.state}:${status.pending}:${status.dropped}`;
    if (key === this.lastEmitted) return;
    this.lastEmitted = key;
    for (const listener of this.listeners) listener(status);
  }
}
