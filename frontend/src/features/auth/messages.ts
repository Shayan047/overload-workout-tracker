import { ApiError, NetworkError } from '@/api/http';

type Credentials = { email: string; password: string };

// Matches the API's own check: one "@", no spaces, a dot in the domain.
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** A problem to fix before signing up, or null. */
export function checkSignUp({ email, password }: Credentials): string | null {
  if (!EMAIL.test(email.trim())) return 'Enter a valid email address.';
  if (password.length < 8) return 'Use at least 8 characters for your password.';
  return null;
}

/** A problem to fix before signing in, or null. */
export function checkSignIn({ email, password }: Credentials): string | null {
  if (!email.trim() || !password) return 'Enter your email and password.';
  return null;
}

/** What to tell the user when sign-in or sign-up fails. */
export function authErrorMessage(error: unknown): string {
  if (error instanceof NetworkError) {
    return 'Can’t reach Overload right now. Check your connection and try again.';
  }
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Wrong email or password.';
    if (error.status === 409) return 'There’s already an account with this email. Sign in instead.';
    if (error.status === 422) return 'Check your email and password.';
  }
  return 'Something went wrong. Try again.';
}
