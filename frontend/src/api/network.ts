import type { Connection, OutboxStatus } from './outbox';

/** The parts of a NetInfo state the connection rule needs. */
export type NetworkState = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
};

/**
 * Whether the outbox may send now: any connection with internet will do, Wi-Fi or mobile
 * data. Reachability that hasn't been checked yet (null) is given the benefit of the doubt;
 * a failed send just retries.
 */
export function connectionFor(network: NetworkState): Connection {
  if (!network.isConnected || network.isInternetReachable === false) {
    return { canSend: false, reason: 'offline' };
  }
  return { canSend: true, reason: 'ok' };
}

/** The sync status line (07 shows "Saved on this phone"); null when nothing is waiting. */
export function syncStatusText(status: OutboxStatus): string | null {
  if (status.pending === 0) return null;
  if (status.state === 'signed-out') return 'Sign in to sync';
  return 'Saved on this phone';
}
