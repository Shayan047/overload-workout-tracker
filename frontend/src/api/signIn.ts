type SignInSteps<T> = {
  request: () => Promise<T>;
  /** The last user on this phone, kept through an expired session. */
  previousUser: () => Promise<string | null>;
  /** Drops the unsent writes and cached data. */
  discardOnboarding: () => Promise<void>;
  start: (response: T) => Promise<void>;
};

/** Signing in shows the account as it is. With nobody on the phone before, anything unsent is
 * onboarding picks made before this sign-in, so they go rather than change the account. A user
 * back after an expired session keeps their unsent workouts. Only after the request succeeds:
 * with a wrong password the picks stay, and they may still sign up. */
export async function signInAndKeepAccount<T>(steps: SignInSteps<T>): Promise<void> {
  const response = await steps.request();
  if (!(await steps.previousUser())) await steps.discardOnboarding();
  await steps.start(response);
}
