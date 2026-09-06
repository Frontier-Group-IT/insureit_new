import { Ionicons } from '@expo/vector-icons';
import { AppState, type AppStateStatus, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { partnerSuccessHaptic, partnerWarningHaptic } from '@/lib/partner-haptics';
import {
  authenticatePartnerLocally,
  getPartnerBiometricCapability,
  getPartnerBiometricLockEnabled,
  setPartnerBiometricLockEnabled,
} from '@/lib/partner-native-security';
import { partnerTheme } from '@/lib/theme';
import { usePartnerSession } from '@/providers/partner-session-provider';

const REENTRY_AFTER_MS = 2 * 60 * 1000;

type PartnerBiometricLockValue = {
  enabled: boolean;
  available: boolean;
  locked: boolean;
  ready: boolean;
  setEnabled: (enabled: boolean) => Promise<{ ok: boolean; reason?: string }>;
  unlock: () => Promise<boolean>;
};

const PartnerBiometricLockContext = createContext<PartnerBiometricLockValue | null>(null);

export function PartnerBiometricLockProvider({ children }: PropsWithChildren) {
  const session = usePartnerSession();
  const [enabled, setEnabledState] = useState(false);
  const [available, setAvailable] = useState(false);
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const promptedForReadySession = useRef(false);

  useEffect(() => {
    let active = true;
    if (Platform.OS === 'web') {
      setReady(true);
      return () => { active = false; };
    }

    void Promise.all([getPartnerBiometricLockEnabled(), getPartnerBiometricCapability()]).then(([stored, capability]) => {
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
      const result = await authenticatePartnerLocally();
      if (result.success) {
        setLocked(false);
        void partnerSuccessHaptic();
        return true;
      }
      void partnerWarningHaptic();
      return false;
    } finally {
      setUnlocking(false);
    }
  }, [enabled, unlocking]);

  const setEnabled = useCallback(async (next: boolean) => {
    if (Platform.OS === 'web') return { ok: false, reason: 'Biometric lock is available in the installed mobile app.' };
    if (!next) {
      await setPartnerBiometricLockEnabled(false);
      setEnabledState(false);
      setLocked(false);
      promptedForReadySession.current = false;
      return { ok: true };
    }

    const capability = await getPartnerBiometricCapability();
    setAvailable(capability.available);
    if (!capability.available) return { ok: false, reason: 'No enrolled biometric or secure device credential is available.' };

    const result = await authenticatePartnerLocally('Enable biometric lock');
    if (!result.success) return { ok: false, reason: 'Biometric lock was not enabled.' };

    await setPartnerBiometricLockEnabled(true);
    setEnabledState(true);
    setLocked(false);
    promptedForReadySession.current = true;
    void partnerSuccessHaptic();
    return { ok: true };
  }, []);

  useEffect(() => {
    if (!ready || !enabled || session.status !== 'ready' || Platform.OS === 'web') {
      if (session.status !== 'ready') promptedForReadySession.current = false;
      return;
    }
    if (promptedForReadySession.current) return;
    promptedForReadySession.current = true;
    setLocked(true);
    void unlock();
  }, [ready, enabled, session.status, unlock]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previous = appState.current;
      appState.current = nextState;

      if (nextState === 'background' || nextState === 'inactive') {
        if (previous === 'active') backgroundedAt.current = Date.now();
        return;
      }

      if (nextState === 'active' && enabled && session.status === 'ready' && backgroundedAt.current) {
        const elapsed = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (elapsed >= REENTRY_AFTER_MS) {
          setLocked(true);
          void unlock();
        }
      }
    });
    return () => subscription.remove();
  }, [enabled, session.status, unlock]);

  const value = useMemo(() => ({ enabled, available, locked, ready, setEnabled, unlock }), [enabled, available, locked, ready, setEnabled, unlock]);

  return (
    <PartnerBiometricLockContext.Provider value={value}>
      {children}
      {locked && session.status === 'ready' ? (
        <View accessibilityViewIsModal style={styles.overlay}>
          <View style={styles.lockCard}>
            <View style={styles.iconWrap}>
              <Ionicons name="finger-print-outline" size={28} color={partnerTheme.colors.brand} />
            </View>
            <Text style={styles.title}>INSUREIT Partner is locked</Text>
            <Text style={styles.copy}>Confirm it is you to return to your Partner workspace.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Unlock INSUREIT Partner"
              disabled={unlocking}
              onPress={() => void unlock()}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed, unlocking && styles.disabled]}
            >
              <Text style={styles.primaryText}>{unlocking ? 'Confirming…' : 'Unlock'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void session.signOut()} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>Sign out</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </PartnerBiometricLockContext.Provider>
  );
}

export function usePartnerBiometricLock() {
  const value = useContext(PartnerBiometricLockContext);
  if (!value) throw new Error('usePartnerBiometricLock must be used inside PartnerBiometricLockProvider.');
  return value;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: partnerTheme.colors.canvas,
  },
  lockCard: { width: '100%', maxWidth: 420, alignItems: 'center', padding: 22, borderRadius: partnerTheme.radius.xl, borderWidth: 1, borderColor: partnerTheme.colors.line, backgroundColor: partnerTheme.colors.surface },
  iconWrap: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  title: { marginTop: 14, color: partnerTheme.colors.ink, textAlign: 'center', ...partnerTheme.typography.sectionTitle },
  copy: { marginTop: 6, color: partnerTheme.colors.inkMuted, textAlign: 'center', ...partnerTheme.typography.body },
  primary: { width: '100%', minHeight: partnerTheme.control.minTouchTarget, marginTop: 18, alignItems: 'center', justifyContent: 'center', borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.brand },
  primaryText: { color: '#FFFFFF', ...partnerTheme.typography.bodyStrong },
  secondary: { minHeight: partnerTheme.control.minTouchTarget, marginTop: 6, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: partnerTheme.colors.brand, ...partnerTheme.typography.bodyStrong },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.6 },
});
