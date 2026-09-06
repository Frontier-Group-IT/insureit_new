import { usePathname } from 'expo-router';
import { type PropsWithChildren, useEffect } from 'react';

import {
  disablePartnerAppSwitcherPrivacy,
  enablePartnerAppSwitcherPrivacy,
  protectPartnerSensitiveScreen,
  releasePartnerSensitiveScreen,
} from '@/lib/partner-native-security';

const SENSITIVE_ROUTE_PATTERNS = [
  /^\/customer\/[^/]+$/,
  /^\/claim\/[^/]+$/,
  /^\/policy-intake-new$/,
  /^\/policy-intakes\/[^/]+$/,
] as const;

export function isPartnerSensitivePath(pathname: string) {
  return SENSITIVE_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function PartnerSensitivePrivacyProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const sensitive = isPartnerSensitivePath(pathname);

  useEffect(() => {
    if (!sensitive) return;

    void protectPartnerSensitiveScreen();
    void enablePartnerAppSwitcherPrivacy();

    return () => {
      void releasePartnerSensitiveScreen();
      void disablePartnerAppSwitcherPrivacy();
    };
  }, [sensitive]);

  return children;
}
