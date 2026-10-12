import { connectionFor, syncStatusText } from '../network';

describe('connectionFor (the Wi-Fi rule)', () => {
  const wifi = { type: 'wifi', isConnected: true, isInternetReachable: true };
  const cellular = { type: 'cellular', isConnected: true, isInternetReachable: true };

  test('Wi-Fi with internet can send', () => {
    expect(connectionFor(wifi, true)).toEqual({ canSend: true, reason: 'ok' });
  });

  test('mobile data waits for Wi-Fi when "Sync on Wi-Fi only" is on', () => {
    expect(connectionFor(cellular, true)).toEqual({ canSend: false, reason: 'needs-wifi' });
    expect(connectionFor(cellular, false)).toEqual({ canSend: true, reason: 'ok' });
  });

  test('ethernet counts as Wi-Fi', () => {
    expect(connectionFor({ ...wifi, type: 'ethernet' }, true).canSend).toBe(true);
  });

  test('no connection, or Wi-Fi without internet, is offline', () => {
    expect(connectionFor({ type: 'none', isConnected: false, isInternetReachable: false }, true)).toEqual({
      canSend: false,
      reason: 'offline',
    });
    expect(connectionFor({ ...wifi, isInternetReachable: false }, true).reason).toBe('offline');
  });

  test('reachability not checked yet still lets Wi-Fi send', () => {
    expect(connectionFor({ ...wifi, isInternetReachable: null }, true).canSend).toBe(true);
  });
});

describe('syncStatusText (the copy in the status pill)', () => {
  test('nothing waiting: no pill', () => {
    expect(syncStatusText({ pending: 0, state: 'idle', dropped: 0 })).toBeNull();
  });

  test('offline, sending or retrying: saved on this phone', () => {
    for (const state of ['offline', 'sending', 'retrying'] as const) {
      expect(syncStatusText({ pending: 2, state, dropped: 0 })).toBe('Saved on this phone');
    }
  });

  test('on mobile data with Wi-Fi only: the count waiting for Wi-Fi (07)', () => {
    expect(syncStatusText({ pending: 1, state: 'waiting-for-wifi', dropped: 0 })).toBe('1 waiting for Wi-Fi');
    expect(syncStatusText({ pending: 3, state: 'waiting-for-wifi', dropped: 0 })).toBe('3 waiting for Wi-Fi');
  });

  test('signed out', () => {
    expect(syncStatusText({ pending: 1, state: 'signed-out', dropped: 0 })).toBe('Sign in to sync');
  });
});
