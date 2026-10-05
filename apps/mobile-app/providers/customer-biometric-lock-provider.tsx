import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { AppState, type AppStateStatus, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  authenticateCustomerLocally,
  getCustomerBiometricCapability,
  getCustomerBiometricLockEnabled,
  setCustomerBiometricLockEnabled,
} from '@/lib/customer-native-security';
import { palette, roleTheme } from '@/lib/theme';

const REENTRY_AFTER_MS = 2 * 60 * 1000;

type CustomerBiometricLockValue = {
  enabled: boolean;
  available: boolean;
  locked: boolean;
  ready: boolean;
  setEnabled: (enabled: boolean) => Promise<{ ok: boolean; reason?: string }>;
  unlock: () => Promise<boolean>;
};

const CustomerBiometricLockContext = createContext<CustomerBiometricLockValue | null>(null);

export function CustomerBiometricLockProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const customerRoute = pathname.startsWith('/customer');
  const [enabled, setEnabledState] = useState(false);
  const [available, setAvailable] = useState(false);
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const promptedForCustomerSession = useRef(false);

  useEffect(() => {
    let active = true;
    if (Platform.OS === 'web') {
      setReady(true);
      return () => { active = false; };
    }

    void Promise.all([getCustomerBiometricLockEnabled(), getCustomerBiometricCapability()]).then(([stored, capability]) => {
      if (!active) return;
      setEnabledState(stored);
      setAvailable(capability.available);
      setReady(true);
    });

    return () => { active = false; };
  }, []);

  const unlock = useCallback(async () => {
    if (!enabled || Platform.OS === 'web') {
      setLocked(false);
      return true;
    }
    if (unlocking) return false;

    setUnlocking(true);
    try {
      const result = await authenticateCustomerLocally();
      if (result.success) {
        setLocked(false);
        return true;
      }
      return false;
    } finally {
      setUnlocking(false);
    }
  }, [enabled, unlocking]);

  const setEnabled = useCallback(async (next: boolean) => {
    if (Platform.OS === 'web') return { ok: false, reason: 'Biometric re-entry is available in the installed mobile app.' };

    if (!next) {
      await setCustomerBiometricLockEnabled(false);
      setEnabledState(false);
      setLocked(false);
      promptedForCustomerSession.current = false;
      return { ok: true };
    }

    const capability = await getCustomerBiometricCapability();
    setAvailable(capability.available);
    if (!capability.available) return { ok: false, reason: 'No enrolled biometric or secure device credential is available.' };

    const result = await authenticateCustomerLocally('Enable biometric re-entry');
    if (!result.success) return { ok: false, reason: 'Biometric re-entry was not enabled.' };

    await setCustomerBiometricLockEnabled(true);
    setEnabledState(true);
    setLocked(false);
    promptedForCustomerSession.current = true;
    return { ok: true };
  }, []);

  useEffect(() => {
    if (!customerRoute) {
      setLocked(false);
      promptedForCustomerSession.current = false;
      return;
    }
    if (!ready || !enabled || Platform.OS === 'web' || promptedForCustomerSession.current) return;

    promptedForCustomerSession.current = true;
    setLocked(true);
    void unlock();
  }, [customerRoute, enabled, ready, unlock]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previous = appState.current;
      appState.current = nextState;

      if (nextState === 'background' || nextState === 'inactive') {
        if (previous === 'active') backgroundedAt.current = Date.now();
        return;
      }

      if (nextState === 'active' && enabled && customerRoute && backgroundedAt.current) {
        const elapsed = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (elapsed >= REENTRY_AFTER_MS) {
          setLocked(true);
          void unlock();
        }
      }
    });

    return () => subscription.remove();
  }, [customerRoute, enabled, unlock]);

  const value = useMemo(() => ({ enabled, available, locked, ready, setEnabled, unlock }), [enabled, available, locked, ready, setEnabled, unlock]);

  return (
    <CustomerBiometricLockContext.Provider value={value}>
      {children}
      {locked && customerRoute ? (
        <View accessibilityViewIsModal style={styles.overlay}>
          <View style={styles.lockCard}>
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name="fingerprint" size={30} color={roleTheme.customer.accent} />
            </View>
            <Text style={styles.title}>INSUREIT is locked</Text>
            <Text style={styles.copy}>Confirm it is you to continue to your account.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Unlock INSUREIT"
              disabled={unlocking}
              onPress={() => void unlock()}
              style={[styles.primary, unlocking && styles.disabled]}
            >
              <Text style={styles.primaryText}>{unlocking ? 'Confirming…' : 'Unlock'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </CustomerBiometricLockContext.Provider>
  );
}

export function useCustomerBiometricLock() {
  const value = useContext(CustomerBiometricLockContext);
  if (!value) throw new Error('useCustomerBiometricLock must be used inside CustomerBiometricLockProvider.');
  return value;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30000,
    elevation: 30000,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#F4F8FC',
  },
  lockCard: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    padding: 22,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#DCE8F4',
    backgroundColor: '#FFFFFF',
  },
  iconWrap: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF5FF' },
  title: { marginTop: 14, color: palette.ink, textAlign: 'center', fontSize: 19, fontWeight: '900' },
  copy: { marginTop: 6, color: palette.slate, textAlign: 'center', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  primary: { width: '100%', minHeight: 48, marginTop: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: roleTheme.customer.accent },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.6 },
});
