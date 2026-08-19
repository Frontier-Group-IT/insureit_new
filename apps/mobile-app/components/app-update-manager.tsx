import * as Updates from 'expo-updates';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'restarting';

const statusCopy: Record<Exclude<UpdateStatus, 'idle' | 'checking'>, string> = {
  downloading: 'Updating app',
  restarting: 'Restarting app',
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function AppUpdateManager() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const isChecking = useRef(false);
  const shimmer = useRef(new Animated.Value(0)).current;

  const checkForUpdates = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled || isChecking.current) {
      return;
    }

    isChecking.current = true;

    try {
      setStatus('checking');
      const update = await withTimeout(Updates.checkForUpdateAsync(), 5000, 'Update check');

      if (!update.isAvailable) {
        return;
      }

      setStatus('downloading');
      await withTimeout(Updates.fetchUpdateAsync(), 15000, 'Update download');

      setStatus('restarting');
      await Updates.reloadAsync();
    } catch (error) {
      console.warn('App update check failed', error);
    } finally {
      setStatus('idle');
      isChecking.current = false;
    }
  }, []);

  useEffect(() => {
    void checkForUpdates();
  }, [checkForUpdates]);

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(shimmer, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(shimmer, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [shimmer]);

  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.26, 0.52, 0.26] });

  if (__DEV__ || status === 'idle' || status === 'checking') {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.iconShell} />
        <View style={styles.copy}>
          <Animated.View style={[styles.skeletonTitle, { opacity: shimmerOpacity }]} />
          <Animated.View style={[styles.skeletonText, { opacity: shimmerOpacity }]} />
          <Text style={styles.title}>{statusCopy[status]}</Text>
          <Text style={styles.message}>Please keep the app open for a moment.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(245, 248, 252, 0.82)',
    justifyContent: 'center',
    padding: 24,
    zIndex: 9999,
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D9E2EF',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    maxWidth: 360,
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowColor: '#0A2342',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
  },
  iconShell: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#EAF2FD',
  },
  copy: {
    flex: 1,
  },
  skeletonTitle: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5EDF7',
    width: '58%',
    marginBottom: 8,
  },
  skeletonText: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EDF3F9',
    width: '80%',
  },
  title: {
    color: '#071D49',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 10,
  },
  message: {
    color: '#5D6B82',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
});
