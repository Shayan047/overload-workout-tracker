import { API_URL, REQUEST_TIMEOUT_MS } from './config';
import type { OutboxEntry, SendResult } from './outbox';

/** The API answered with an error status. `detail` is FastAPI's error detail, if any. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: unknown,
  ) {
    super(`API error ${status}`);
  }
}

/** No answer: offline, unreachable, or timed out. */
export class NetworkError extends Error {}

type Options = { body?: unknown; token?: string | null; timeoutMs?: number };

async function rawRequest(method: string, path: string, options: Options): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined && { 'Content-Type': 'application/json' }),
        ...(options.token && { Authorization: `Bearer ${options.token}` }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : 'Network request failed');
  } finally {
    clearTimeout(timer);
  }
}

/** A direct API call, for reads and for sign-in. Writes go through the outbox instead. */
export async function apiRequest<T>(method: string, path: string, options: Options = {}): Promise<T> {
  const response = await rawRequest(method, path, options);
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new ApiError(response.status, (detail as { detail?: unknown } | null)?.detail ?? detail);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Sends one outbox entry and reports the outcome the outbox's rules need. */
export async function sendEntry(entry: OutboxEntry, token: string | null): Promise<SendResult> {
  try {
    const response = await rawRequest(entry.method, entry.path, { body: entry.body, token });
    return response.ok ? { ok: true } : { ok: false, kind: 'http', status: response.status };
  } catch {
    return { ok: false, kind: 'network' };
  }
}
