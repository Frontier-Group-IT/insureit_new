import { useRouter } from 'expo-router';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

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
const minimumVisibleMs = 220;
const quietPeriodMs = 140;

export function AppLoadingProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<TrackedLoadingEntry[]>(getTrackedLoadingEntries());
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [overlayLabel, setOverlayLabel] = useState(entries[entries.length - 1]?.label || 'Loading');
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayShownAt = useRef(entries.length > 0 ? Date.now() : 0);
  const overlayVisibleRef = useRef(true);

  const begin = useCallback((label = 'Loading') => beginTrackedLoading(label), []);
  const end = useCallback((id: string) => endTrackedLoading(id), []);

  useEffect(() => subscribeTrackedLoading(setEntries), []);

  useEffect(() => {
    if (startupTimer.current) clearTimeout(startupTimer.current);
    startupTimer.current = setTimeout(() => {
      if (entries.length === 0) {
        overlayVisibleRef.current = false;
        setOverlayVisible(false);
      }
      startupTimer.current = null;
    }, 900);

    return () => {
      if (startupTimer.current) clearTimeout(startupTimer.current);
      startupTimer.current = null;
    };
  }, [entries]);

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

  const beginNavigation = useCallback((label = 'Opening page') => {
    void label;
  }, []);

  const runWithLoader = useCallback(<T,>(task: () => Promise<T>, label = 'Processing request') => withTrackedLoading(task, label), []);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (startupTimer.current) clearTimeout(startupTimer.current);
  }, []);

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
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={styles.overlay}>
      <View style={styles.loaderCard}>
        <ActivityIndicator size="large" color={palette.blue} />
        <Text style={styles.loaderText}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    elevation: 10000,
    backgroundColor: 'rgba(242,247,252,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  loaderCard: {
    width: 180,
    minHeight: 120,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(198,211,225,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    shadowColor: '#102443',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  loaderText: {
    marginTop: 10,
    color: '#1D3557',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
