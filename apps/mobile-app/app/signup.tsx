import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { routeSignedInUser, signUp } from '@/lib/auth';
import { Button, Card, Message, Screen, TextField, styles } from '@/components/ui';

export default function SignupScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit() {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await signUp(email.trim(), password, fullName.trim(), phone.trim());
      if (data.user && data.session) {
        await routeSignedInUser(data.user, router);
      } else {
        setMessage('Account created. Please check your email before signing in.');
      }
    } catch {
      setError('We could not create your account. Please review the details and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen title="Create account" subtitle="Start tracking your vehicle policy and claim support.">
      <Card>
        {error ? <Message type="error">{error}</Message> : null}
        {message ? <Message type="success">{message}</Message> : null}
        <TextField label="Full name" value={fullName} onChangeText={setFullName} />
        <TextField label="Phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        <TextField label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextField label="Password" secureTextEntry value={password} onChangeText={setPassword} />
        <Button label={loading ? 'Creating account...' : 'Create account'} disabled={loading} onPress={submit} />
      </Card>
      <Text style={styles.muted}>Already registered? <Link href="/login" style={styles.rowValue}>Sign in</Link></Text>
    </Screen>
  );
}
