import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, InteractionManager, StyleSheet, Text, View } from 'react-native';

import {
  beginTrackedLoading,
  endTrackedLoading,
  getTrackedLoadingEntries,
  subscribeTrackedLoading,
  withTrackedLoading,
  type TrackedLoadingEntry,
} from '@/lib/loading-tracker';
import { palette } from '@/lib/theme';

type LoadingContextValue = {
  begin: (label?: string) => string;
  end: (id: string) => void;
  beginNavigation: (label?: string) => void;
  runWithLoader: <T>(task: () => Promise<T>, label?: string) => Promise<T>;
};

const LoadingContext = createContext<LoadingContextValue | null>(null);
const navigationFallbackMs = 12000;
const noRouteChangeFallbackMs = 1600;
const settleDelayMs = 160;
const minimumVisibleMs = 420;
const quietPeriodMs = 220;

export function AppLoadingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [entries, setEntries] = useState<TrackedLoadingEntry[]>(getTrackedLoadingEntries());
  const [overlayVisible, setOverlayVisible] = useState(entries.length > 0);
  const [overlayLabel, setOverlayLabel] = useState(entries[entries.length - 1]?.label || 'Loading');
  const mounted = useRef(false);
  const previousPath = useRef(pathname);
  const navigationId = useRef<string | null>(null);
  const navigationStartPath = useRef(pathname);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const samePathTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayShownAt = useRef(entries.length > 0 ? Date.now() : 0);
  const overlayVisibleRef = useRef(entries.length > 0);

  const begin = useCallback((label = 'Loading') => beginTrackedLoading(label), []);
  const end = useCallback((id: string) => endTrackedLoading(id), []);

  useEffect(() => subscribeTrackedLoading(setEntries), []);

  useEffect(() => {
    if (entries.length > 0) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = null;
      setOverlayLabel(entries[entries.length - 1]?.label || 'Loading');
      if (!overlayVisibleRef.current) {
        overlayVisibleRef.current = true;
        overlayShownAt.current = Date.now();
        setOverlayVisible(true);
      }
      return;
    }

    if (!overlayVisibleRef.current) return;
    const elapsed = Date.now() - overlayShownAt.current;
    const delay = Math.max(quietPeriodMs, minimumVisibleMs - elapsed);
    hideTimer.current = setTimeout(() => {
      overlayVisibleRef.current = false;
      setOverlayVisible(false);
      hideTimer.current = null;
    }, delay);
  }, [entries]);

  const clearNavigationTimers = useCallback(() => {
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    if (samePathTimer.current) clearTimeout(samePathTimer.current);
    fallbackTimer.current = null;
    samePathTimer.current = null;
  }, []);

  const finishNavigation = useCallback(() => {
    const id = navigationId.current;
    navigationId.current = null;
    clearNavigationTimers();
    if (id) end(id);
  }, [clearNavigationTimers, end]);

  const settleAfterRender = useCallback(() => {
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(finishNavigation, settleDelayMs);
        });
      });
    });
  }, [finishNavigation]);

  const beginNavigation = useCallback((label = 'Opening page') => {
    if (navigationId.current) end(navigationId.current);
    clearNavigationTimers();
    navigationStartPath.current = pathname;
    navigationId.current = begin(label);
    fallbackTimer.current = setTimeout(finishNavigation, navigationFallbackMs);
    samePathTimer.current = setTimeout(() => {
      if (navigationStartPath.current === previousPath.current) finishNavigation();
    }, noRouteChangeFallbackMs);
  }, [begin, clearNavigationTimers, end, finishNavigation, pathname]);

  const runWithLoader = useCallback(<T,>(task: () => Promise<T>, label = 'Processing request') => withTrackedLoading(task, label), []);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      previousPath.current = pathname;
      return;
    }
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    if (!navigationId.current) {
      navigationId.current = begin('Loading page');
      fallbackTimer.current = setTimeout(finishNavigation, navigationFallbackMs);
    }
    settleAfterRender();
  }, [begin, finishNavigation, pathname, settleAfterRender]);

  useEffect(() => () => {
    clearNavigationTimers();
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, [clearNavigationTimers]);

  const value = useMemo<LoadingContextValue>(() => ({ begin, end, beginNavigation, runWithLoader }), [begin, beginNavigation, end, runWithLoader]);

  return <LoadingContext.Provider value={value}>
    {children}
    {overlayVisible ? <AppLoadingOverlay label={overlayLabel} /> : null}
  </LoadingContext.Provider>;
}

export function useAppLoading() {
  const value = useContext(LoadingContext);
  if (!value) throw new Error('useAppLoading must be used inside AppLoadingProvider.');
  return value;
}

export function usePageLoading(loading: boolean, label = 'Loading page') {
  void loading;
  void label;
}

export function useLoadingRouter(): ReturnType<typeof useRouter> {
  const router = useRouter();
  return router;
}

function AppLoadingOverlay({ label }: { label: string }) {
  return <View accessibilityRole="progressbar" accessibilityLabel={label} style={styles.overlay}>
    <View style={styles.card}>
      <View style={styles.iconShell}>
        <MaterialCommunityIcons name="shield-check-outline" size={30} color="#0A43A3" />
      </View>
      <ActivityIndicator size="large" color="#0A43A3" />
      <Text style={styles.title}>{label}</Text>
      <Text style={styles.subtitle}>Please wait while InsureIT finishes loading.</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    elevation: 10000,
    backgroundColor: 'rgba(247,249,253,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    minHeight: 220,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE6F0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    shadowColor: '#122544',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  iconShell: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: '#EEF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    marginTop: 14,
    color: palette.navy,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    color: '#65758B',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
