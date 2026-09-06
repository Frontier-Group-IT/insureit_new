import { useRouter } from 'expo-router';
import { type PropsWithChildren, useEffect } from 'react';

import {
  configurePartnerNotificationChannel,
  getInitialPartnerNotificationPath,
  observePartnerNotificationResponses,
  registerPartnerPushDevice,
} from '@/lib/partner-notifications';
import { usePartnerSession } from '@/providers/partner-session-provider';

export function PartnerNativeRuntimeProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const session = usePartnerSession();

  useEffect(() => {
    void configurePartnerNotificationChannel().catch(() => undefined);

    let active = true;
    void getInitialPartnerNotificationPath().then((path) => {
      if (active && path) router.push(path as never);
    });

    const subscription = observePartnerNotificationResponses((path) => {
      router.push(path as never);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [router]);

  useEffect(() => {
    if (session.status !== 'ready') return;
    void registerPartnerPushDevice().catch(() => undefined);
  }, [session.status]);

  return children;
}
