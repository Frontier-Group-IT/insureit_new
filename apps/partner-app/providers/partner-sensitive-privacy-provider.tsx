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

const SCREEN_CAPTURE_RESTRICTION_ENABLED = false;

export function PartnerSensitivePrivacyProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const sensitive = isPartnerSensitivePath(pathname);

  useEffect(() => {
    if (!SCREEN_CAPTURE_RESTRICTION_ENABLED) {
      void releasePartnerSensitiveScreen();
      void disablePartnerAppSwitcherPrivacy();
      return;
    }

    if (!sensitive) {
      void releasePartnerSensitiveScreen();
      void disablePartnerAppSwitcherPrivacy();
      return;
    }

    void protectPartnerSensitiveScreen();
    void enablePartnerAppSwitcherPrivacy();

    return () => {
      void releasePartnerSensitiveScreen();
      void disablePartnerAppSwitcherPrivacy();
    };
  }, [sensitive]);

  return children;
}
