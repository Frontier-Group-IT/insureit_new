import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ClaimVideoSourceModalHost } from '@/lib/claim-video-document-picker';
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
const minimumVisibleMs = 420;
const quietPeriodMs = 220;

export function AppLoadingProvider({ children }: { children: ReactNode }) {
  const initialEntries = getTrackedLoadingEntries();
  const initialLabel = initialEntries[initialEntries.length - 1]?.label || 'Loading';
  const [entries, setEntries] = useState<TrackedLoadingEntry[]>(initialEntries);
  const [overlayVisible, setOverlayVisible] = useState(initialEntries.length > 0);
  const [overlayLabel, setOverlayLabel] = useState(initialLabel);
  const [overlayProgress, setOverlayProgress] = useState<number | null>(() => uploadProgress(initialEntries, initialLabel));
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayShownAt = useRef(initialEntries.length > 0 ? Date.now() : 0);
  const overlayVisibleRef = useRef(initialEntries.length > 0);

  const begin = useCallback((label = 'Loading') => beginTrackedLoading(label), []);
  const end = useCallback((id: string) => endTrackedLoading(id), []);

  useEffect(() => subscribeTrackedLoading(setEntries), []);

  useEffect(() => {
    if (entries.length > 0) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = null;
      const nextLabel = entries[entries.length - 1]?.label || 'Loading';
      setOverlayLabel(nextLabel);
      setOverlayProgress(uploadProgress(entries, nextLabel));
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
      setOverlayProgress(null);
      hideTimer.current = null;
    }, delay);
  }, [entries]);

  const beginNavigation = useCallback((label = 'Opening page') => {
    void label;
  }, []);

  const runWithLoader = useCallback(<T,>(task: () => Promise<T>, label = 'Processing request') => withTrackedLoading(task, label), []);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const value = useMemo<LoadingContextValue>(() => ({ begin, end, beginNavigation, runWithLoader }), [begin, beginNavigation, end, runWithLoader]);

  return <LoadingContext.Provider value={value}>
    {children}
    {overlayVisible ? <AppLoadingOverlay label={overlayLabel} progress={overlayProgress} /> : null}
    <ClaimVideoSourceModalHost />
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

function loadingSubtitle(label: string) {
  if (label === 'Uploading document') return 'Please wait while InsureIT uploads the document.';
  if (label === 'Deleting document') return 'Please wait while InsureIT deletes the document.';
  if (label === 'Updating document') return 'Please wait while InsureIT updates the document.';
  if (label === 'Processing document') return 'Please wait while InsureIT processes the document.';
  return 'Please wait while InsureIT finishes loading.';
}

function uploadProgress(entries: TrackedLoadingEntry[], activeLabel: string) {
  if (activeLabel !== 'Uploading document') return null;
  const uploadEntries = entries.filter((entry) => entry.label === 'Uploading document' && typeof entry.progress === 'number');
  if (!uploadEntries.length) return null;
  return uploadEntries.reduce((total, entry) => total + (entry.progress ?? 0), 0) / uploadEntries.length;
}

function AppLoadingOverlay({ label, progress }: { label: string; progress: number | null }) {
  const progressPercent = progress === null ? null : Math.max(0, Math.min(100, Math.round(progress * 100)));
  return <View
    accessibilityRole="progressbar"
    accessibilityLabel={label}
    accessibilityValue={progressPercent === null ? undefined : { min: 0, max: 100, now: progressPercent }}
    style={styles.overlay}
  >
    <View style={styles.card}>
      <View style={styles.iconShell}>
        <MaterialCommunityIcons name="shield-check-outline" size={30} color="#0A43A3" />
      </View>
      {progressPercent === null ? (
        <ActivityIndicator size="large" color="#0A43A3" />
      ) : (
        <>
          <Text style={styles.progressValue}>{progressPercent}%</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
        </>
      )}
      <Text style={styles.title}>{label}</Text>
      <Text style={styles.subtitle}>{loadingSubtitle(label)}</Text>
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
  progressValue: {
    color: '#0A43A3',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    textAlign: 'center',
  },
  progressTrack: {
    marginTop: 10,
    width: '82%',
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#E4ECF5',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#0A43A3',
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
