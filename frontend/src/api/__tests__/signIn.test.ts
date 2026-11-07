import { signInAndKeepAccount } from '../signIn';

function steps(previousUser: string | null, request: () => Promise<string> = async () => 'token') {
  const calls: string[] = [];
  return {
    calls,
    deps: {
      request: async () => {
        calls.push('request');
        return request();
      },
      previousUser: async () => previousUser,
      discardOnboarding: async () => {
        calls.push('discard');
      },
      start: async (response: string) => {
        calls.push(`start:${response}`);
      },
    },
  };
}

describe('signing in shows the account as it is', () => {
  test('nobody was on this phone: the queue can only be onboarding picks, so they go', async () => {
    const { calls, deps } = steps(null);
    await signInAndKeepAccount(deps);
    expect(calls).toEqual(['request', 'discard', 'start:token']);
  });

  test('the same user back after an expired session keeps their unsent workouts', async () => {
    const { calls, deps } = steps('user-1');
    await signInAndKeepAccount(deps);
    expect(calls).toEqual(['request', 'start:token']);
  });

  test('a wrong password keeps the onboarding picks: they may still sign up', async () => {
    const { calls, deps } = steps(null, async () => {
      throw new Error('401');
    });
    await expect(signInAndKeepAccount(deps)).rejects.toThrow('401');
    expect(calls).toEqual(['request']);
  });
});
