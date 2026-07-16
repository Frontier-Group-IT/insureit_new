import * as Updates from 'expo-updates';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'restarting';

const statusCopy: Record<Exclude<UpdateStatus, 'idle'>, string> = {
  checking: 'Checking for app update',
  downloading: 'Updating app',
  restarting: 'Restarting app',
};

export function AppUpdateManager() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const isChecking = useRef(false);

  const checkForUpdates = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled || isChecking.current) {
      return;
    }

    isChecking.current = true;

    try {
      setStatus('checking');
      const update = await Updates.checkForUpdateAsync();

      if (!update.isAvailable) {
        setStatus('idle');
        return;
      }

      setStatus('downloading');
      await Updates.fetchUpdateAsync();

      setStatus('restarting');
      await Updates.reloadAsync();
    } catch (error) {
      console.warn('App update check failed', error);
      setStatus('idle');
    } finally {
      isChecking.current = false;
    }
  }, []);

  useEffect(() => {
    void checkForUpdates();
  }, [checkForUpdates]);

  if (__DEV__ || status === 'idle') {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <ActivityIndicator color="#0A5BC4" />
        <View style={styles.copy}>
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
  copy: {
    flex: 1,
  },
  title: {
    color: '#071D49',
    fontSize: 15,
    fontWeight: '800',
  },
  message: {
    color: '#5D6B82',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
});
