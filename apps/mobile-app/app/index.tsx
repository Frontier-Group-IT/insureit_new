import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { getCurrentSession, getRestoredSession } from '@/lib/auth';
import { logStartupDiagnostic } from '@/lib/startup-diagnostics';
import { routeRestoredUser } from '@/lib/startup-routing';
import { Screen, Button, LoadingState, Message } from '@/components/ui';

export default function IndexScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      await logStartupDiagnostic('bootstrap_started');
      try {
        const restoredSession = await withTimeout(getRestoredSession(), 10000);
        const session = restoredSession ?? await confirmStoredSession();
        await logStartupDiagnostic('session_resolved', { sessionPresent: Boolean(session?.user) });

        if (session?.user) {
          await withTimeout(routeRestoredUser(session.user, router), 12000);
        } else {
          await logStartupDiagnostic('routing_to_login', { reason: 'no_restored_session' });
          router.replace('/login');
        }
      } catch {
        await logStartupDiagnostic('bootstrap_failed', { reason: 'startup_or_account_resolution_failed' });
        if (active) setError('We could not open your account. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [attempt, router]);

  if (loading) {
    return (
      <Screen title="InsureIT" subtitle="Opening your account." showTitleHeader={false} showBackNavigation={false}>
        <LoadingState label="Opening InsureIT" />
      </Screen>
    );
  }

  return (
    <Screen title="InsureIT" subtitle="Policy support and claim access." showBackNavigation={false}>
      {error ? <Message type="error">{error}</Message> : null}
      <Button label="Try again" onPress={() => setAttempt((value) => value + 1)} />
      <Button label="Sign in" onPress={() => router.replace('/login')} />
    </Screen>
  );
}

async function confirmStoredSession() {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  return getCurrentSession();
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out')), timeoutMs);
    }),
  ]);
}
