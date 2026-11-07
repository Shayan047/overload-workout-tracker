import { connectionFor, syncStatusText } from '../network';

describe('connectionFor (only having no internet holds writes back)', () => {
  const online = { isConnected: true, isInternetReachable: true };

  test('any connection with internet can send, mobile data included', () => {
    expect(connectionFor(online)).toEqual({ canSend: true, reason: 'ok' });
    const cellular = { ...online, type: 'cellular' };
    expect(connectionFor(cellular)).toEqual({ canSend: true, reason: 'ok' });
  });

  test('no connection, or a connection without internet, is offline', () => {
    expect(connectionFor({ isConnected: false, isInternetReachable: false })).toEqual({
      canSend: false,
      reason: 'offline',
    });
    expect(connectionFor({ ...online, isInternetReachable: false }).reason).toBe('offline');
  });

  test('reachability not checked yet still sends', () => {
    expect(connectionFor({ ...online, isInternetReachable: null }).canSend).toBe(true);
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

  test('signed out', () => {
    expect(syncStatusText({ pending: 1, state: 'signed-out', dropped: 0 })).toBe('Sign in to sync');
  });
});
