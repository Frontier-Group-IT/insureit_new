import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';

type StartupDiagnosticDetails = {
  sessionPresent?: boolean;
  profilePresent?: boolean;
  customerPresent?: boolean;
  onboardingPresent?: boolean;
  reason?: string;
};

export async function logStartupDiagnostic(stage: string, details: StartupDiagnosticDetails = {}) {
  let hasStoredAuth = false;

  try {
    const keys = await AsyncStorage.getAllKeys();
    hasStoredAuth = keys.some((key) => key.startsWith('sb-') || key.toLowerCase().includes('supabase'));
  } catch {
    // Diagnostics must never interfere with startup.
  }

  console.info('[mobile-startup]', {
    stage,
    updateId: Updates.updateId ?? null,
    embeddedLaunch: Updates.isEmbeddedLaunch,
    hasStoredAuth,
    ...details,
  });
}
