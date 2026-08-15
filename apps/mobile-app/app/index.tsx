import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { getCurrentSession, routeSignedInUser } from '@/lib/auth';
import { LoadingState, Screen, Button, Message } from '@/components/ui';

export default function IndexScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const session = await withTimeout(getCurrentSession(), 12000);
        if (session?.user) {
          await withTimeout(routeSignedInUser(session.user, router), 12000);
        } else {
          router.replace('/login');
        }
      } catch {
        setError('We could not open your account. Please sign in again.');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [router]);

  if (loading) return <Screen title="InsureIT"><LoadingState label="Opening your account" /></Screen>;

  return (
    <Screen title="InsureIT" subtitle="Policy support and claim access.">
      {error ? <Message type="error">{error}</Message> : null}
      <Button label="Sign in" onPress={() => router.replace('/login')} />
    </Screen>
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out')), timeoutMs);
    }),
  ]);
}
