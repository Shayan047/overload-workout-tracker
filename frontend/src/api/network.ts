import type { Connection, OutboxStatus } from './outbox';

/** The parts of a NetInfo state the Wi-Fi rule needs. */
export type NetworkState = {
  type: string;
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
};

/**
 * The Wi-Fi rule: whether the outbox may send now. With "Sync on Wi-Fi only" (on by
 * default), only Wi-Fi or ethernet with internet will do. Reachability that hasn't been
 * checked yet (null) is given the benefit of the doubt; a failed send just retries.
 * Reading data is not limited to Wi-Fi; only the outbox is.
 */
export function connectionFor(network: NetworkState, syncWifiOnly: boolean): Connection {
  if (!network.isConnected || network.isInternetReachable === false) {
    return { canSend: false, reason: 'offline' };
  }
  if (syncWifiOnly && network.type !== 'wifi' && network.type !== 'ethernet') {
    return { canSend: false, reason: 'needs-wifi' };
  }
  return { canSend: true, reason: 'ok' };
}

/** The sync status line (07 shows "1 waiting for Wi-Fi"); null when nothing is waiting. */
export function syncStatusText(status: OutboxStatus): string | null {
  if (status.pending === 0) return null;
  if (status.state === 'signed-out') return 'Sign in to sync';
  if (status.state === 'waiting-for-wifi') return `${status.pending} waiting for Wi-Fi`;
  return 'Saved on this phone';
}
