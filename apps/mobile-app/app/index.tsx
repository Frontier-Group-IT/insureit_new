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
        const session = await getCurrentSession();
        if (session?.user) {
          await routeSignedInUser(session.user, router);
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

  if (loading) return <Screen title="Welcome"><LoadingState label="Opening your account" /></Screen>;

  return (
    <Screen title="Welcome" subtitle="Manage your policy support and claim journey from your phone.">
      {error ? <Message type="error">{error}</Message> : null}
      <Button label="Sign in" onPress={() => router.replace('/login')} />
    </Screen>
  );
}
