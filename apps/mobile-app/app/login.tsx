import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { routeSignedInUser, signIn } from '@/lib/auth';
import { Button, Card, Message, Screen, TextField, styles } from '@/components/ui';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setLoading(true);
    setError('');
    try {
      const data = await signIn(email.trim(), password);
      if (data.user) await routeSignedInUser(data.user, router);
    } catch {
      setError('Sign in failed. Check your email and password, then try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen title="Sign in" subtitle="Access your insurance claim assistance account.">
      <Card>
        {error ? <Message type="error">{error}</Message> : null}
        <TextField label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextField label="Password" secureTextEntry value={password} onChangeText={setPassword} />
        <Button label={loading ? 'Signing in...' : 'Sign in'} disabled={loading} onPress={submit} />
      </Card>
      <Text style={styles.muted}>New customer? <Link href="/signup" style={styles.rowValue}>Create an account</Link></Text>
    </Screen>
  );
}
