import { router } from 'expo-router';
import { useState } from 'react';

import { useAuth } from '@/api/AppProviders';
import { BrandMark, Button, TextField } from '@/components';

import { AuthScreen } from './AuthScreen';
import { authErrorMessage, checkSignIn } from './messages';

export function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const problem = checkSignIn({ email, password });
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(authErrorMessage(e));
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      header={<BrandMark />}
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      error={error}
      fields={
        <>
          <TextField
            labelGap={10}
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
          />
          <TextField
            labelGap={10}
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
        </>
      }
      actions={
        <>
          <Button
            title={busy ? 'Signing in…' : 'Sign in'}
            size="medium"
            onPress={submit}
            disabled={busy}
          />
          <Button
            title="Create an account"
            variant="secondary"
            onPress={() => router.replace('/sign-up')}
          />
        </>
      }
    />
  );
}
