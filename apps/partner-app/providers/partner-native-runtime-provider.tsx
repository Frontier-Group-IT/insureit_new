import { useRouter } from 'expo-router';
import { type PropsWithChildren, useEffect } from 'react';

import {
  configurePartnerNotificationChannel,
  getInitialPartnerNotificationPath,
  observePartnerNotificationResponses,
} from '@/lib/partner-notifications';

export function PartnerNativeRuntimeProvider({ children }: PropsWithChildren) {
  const router = useRouter();

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

  return children;
}
