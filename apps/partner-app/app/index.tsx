import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { getCurrentSession, resolvePartnerSession } from '@/lib/partner-session';

export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const session = await getCurrentSession();
        if (!session?.user) {
          if (!cancelled) router.replace('/login');
          return;
        }
        await resolvePartnerSession();
        if (!cancelled) router.replace('/home');
      } catch {
        if (!cancelled) router.replace('/access-denied');
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
