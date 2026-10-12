import { router } from 'expo-router';
import { useState } from 'react';

import { useAuth } from '@/api/AppProviders';
import { BrandMark, Button, TextField } from '@/components';

import { AuthScreen } from './AuthScreen';
import { authErrorMessage, checkSignUp } from './messages';

export function SignUpScreen() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const problem = checkSignUp({ email, password });
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await signUp(email.trim(), password, name.trim() || null);
    } catch (e) {
      setError(authErrorMessage(e));
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      header={<BrandMark />}
      title="Create your account"
      subtitle="Your workouts are saved on this phone first, then synced to your account."
      error={error}
      fields={
        <>
          <TextField
            labelGap={10}
            label="Name"
            placeholder="Optional"
            value={name}
            onChangeText={setName}
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
          />
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
            hint="At least 8 characters."
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
        </>
      }
      actions={
        <>
          <Button
            title={busy ? 'Creating account…' : 'Create account'}
            size="medium"
            onPress={submit}
            disabled={busy}
          />
          <Button
            title="I already have an account"
            variant="secondary"
            onPress={() => router.replace('/sign-in')}
          />
        </>
      }
    />
  );
}
