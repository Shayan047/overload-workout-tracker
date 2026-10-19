import { ApiError, NetworkError } from '@/api/http';

import { authErrorMessage, checkSignIn, checkSignUp } from '../messages';

describe('checkSignUp', () => {
  test('accepts a normal sign-up', () => {
    expect(checkSignUp({ email: ' Shayan@Example.com ', password: 'correct horse' })).toBeNull();
  });

  test('needs a plausible email', () => {
    expect(checkSignUp({ email: 'shayan', password: 'correct horse' })).toBe('Enter a valid email address.');
    expect(checkSignUp({ email: '', password: 'correct horse' })).toBe('Enter a valid email address.');
  });

  test('needs 8 or more characters of password', () => {
    expect(checkSignUp({ email: 'a@b.co', password: 'short' })).toBe(
      'Use at least 8 characters for your password.',
    );
  });
});

describe('checkSignIn', () => {
  test('needs both fields', () => {
    expect(checkSignIn({ email: '', password: 'x' })).toBe('Enter your email and password.');
    expect(checkSignIn({ email: 'a@b.co', password: '' })).toBe('Enter your email and password.');
    expect(checkSignIn({ email: 'a@b.co', password: 'x' })).toBeNull();
  });
});

describe('authErrorMessage', () => {
  test('wrong credentials', () => {
    expect(authErrorMessage(new ApiError(401, 'Wrong email or password'))).toBe('Wrong email or password.');
  });

  test('email already used', () => {
    expect(authErrorMessage(new ApiError(409, 'Email already in use'))).toBe(
      'There’s already an account with this email. Sign in instead.',
    );
  });

  test('no connection', () => {
    expect(authErrorMessage(new NetworkError('offline'))).toBe(
      'Can’t reach Overload right now. Check your connection and try again.',
    );
  });

  test('anything else', () => {
    expect(authErrorMessage(new ApiError(500, null))).toBe('Something went wrong. Try again.');
    expect(authErrorMessage(new Error('boom'))).toBe('Something went wrong. Try again.');
  });
});
