import * as Updates from 'expo-updates';
import { Stack, useNavigationContainerRef, usePathname, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLoadingProvider } from '@/components/app-loading';
import { SplashIntro } from '@/components/first-look';
import { RealtimeNotificationProvider } from '@/components/realtime-notifications';
import { syncRememberedCustomerSession } from '@/lib/customer-account-vault';
import { installLocalDocumentFetchSupport } from '@/lib/local-document-fetch';
import { supabase } from '@/lib/supabase';
import { CustomerBiometricLockProvider } from '@/providers/customer-biometric-lock-provider';

installLocalDocumentFetchSupport();

export const unstable_settings = { initialRouteName: 'index' };

export default function RootLayout() {
  return (
    <AppLoadingProvider><RootApplication /></AppLoadingProvider>
  );
}

function RootApplication() {
  const navigationState = useRootNavigationState();
  const navigationRef = useNavigationContainerRef();
  const activeRouteRef = useRef<string | null>(null);
  const getDiagnosticRoute = () => {
    const ref = navigationRef as unknown as { getCurrentRoute: () => { name?: string } | undefined };
    return ref.getCurrentRoute()?.name ?? null;
  };
  const pathname = usePathname();
  const previousRoute = useRef<string | null>(null);
  // Observe the navigation container itself, not individual screen handlers.
  // Never include route params, navigation keys, or action payloads in logs.
  useEffect(() => {
    const focus = () => {
      const current = getDiagnosticRoute();
      const previous = activeRouteRef.current;
      if (current === 'customer/start-claim' || previous === 'customer/start-claim') {
        console.warn('[claim-navigation] container-route', { from: previous, to: current });
      }
      activeRouteRef.current = current;
    };
    const unsubscribeState = navigationRef.addListener('state', focus);
    focus();

    // React Navigation emits this internal event on dispatch. It is diagnostic
    // only and optional across library versions; the state listener above remains
    // authoritative when the internal action event isn't implemented.
    type DiagnosticActionEvent = { data?: { action?: { type?: string } } };
    const actionObserver = navigationRef as unknown as {
      addListener?: (event: string, callback: (event: DiagnosticActionEvent) => void) => () => void;
    };
    let unsubscribeAction: (() => void) | undefined;
    try {
      unsubscribeAction = actionObserver.addListener?.('__unsafe_action__', (event) => {
        const current = getDiagnosticRoute();
        if (current === 'customer/start-claim' || activeRouteRef.current === 'customer/start-claim') {
          console.warn('[claim-navigation] navigator-dispatch', {
            type: event.data?.action?.type ?? 'unknown',
            activeRoute: current,
          });
        }
      });
    } catch {
      console.warn('[claim-navigation] action-observer-unavailable');
    }
    return () => {
      unsubscribeState();
      unsubscribeAction?.();
    };
  }, [navigationRef]);
  useEffect(() => {
    if (Platform.OS !== 'android' || pathname !== '/customer/start-claim') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      console.warn('[claim-navigation] android-back-event', { route: '/customer/start-claim' });
      return false; // Observe only; preserve normal Android back handling.
    });
    return () => listener.remove();
  }, [pathname]);
  useEffect(() => {
    if (pathname !== '/customer/start-claim' && previousRoute.current !== '/customer/start-claim') return;
    const routes = navigationState?.routes?.map((route) => route.name) ?? [];
    console.warn('[claim-navigation] nav-state', { route: pathname, routeNames: routes, index: navigationState?.index ?? -1 });
  }, [navigationState, pathname]);
  useEffect(() => {
    const from = previousRoute.current;
    if (from === '/customer/start-claim' || pathname === '/customer/start-claim') {
      console.warn('[claim-navigation] route', { from, to: pathname });
    }
    previousRoute.current = pathname;
  }, [pathname]);
  useEffect(() => {
    console.warn('[claim-navigation] root-mounted', { runtime: Updates.runtimeVersion ?? 'unknown', channel: Updates.channel ?? 'unknown', update: Updates.updateId ?? 'embedded' });
    return () => console.warn('[claim-navigation] root-unmounted');
  }, []);
  const insets = useSafeAreaInsets();
  const { checkError, downloadError, isUpdatePending } = Updates.useUpdates();
  const [minimumIntroComplete, setMinimumIntroComplete] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinimumIntroComplete(true), 1100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session || !['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) return;
      void syncRememberedCustomerSession(session).catch((error) => {
        console.warn('Saved customer session sync failed', error);
      });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Expo applies a downloaded update on the next cold launch. Never call
  // reloadAsync while a customer may be selecting a vehicle or filing a claim:
  // restarting the JS runtime discards the current navigation stack and can
  // silently return the customer to Home.
  useEffect(() => {
    if (!__DEV__ && Updates.isEnabled && isUpdatePending) {
      console.info('[expo-update] Update downloaded; activation deferred until next app launch.');
    }
  }, [isUpdatePending]);

  useEffect(() => {
    const error = checkError ?? downloadError;
    if (!error) return;
    console.warn('[expo-update] Startup update check/download reported an error.', {
      ...runningUpdateIdentity(),
      error: errorMessage(error),
    });
  }, [checkError, downloadError]);

  const introVisible = !minimumIntroComplete || !navigationState?.key;
  const customerRoute = pathname.startsWith('/customer');
  const customerStatusBarVisible = customerRoute && !introVisible;
  return (
    <>
      <StatusBar
        style={introVisible || customerRoute ? 'light' : 'dark'}
        backgroundColor={customerRoute ? '#071D49' : '#EEF7FF'}
      />
      {customerStatusBarVisible ? (
        <View pointerEvents="none" style={[styles.customerStatusBarFill, { height: insets.top }]} />
      ) : null}
      <CustomerBiometricLockProvider>
        <RealtimeNotificationProvider>
          <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="customer/add-vehicle" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          </Stack>
        </RealtimeNotificationProvider>
      </CustomerBiometricLockProvider>
      {introVisible ? <View style={styles.introOverlay}><SplashIntro /></View> : null}
    </>
  );
}

function runningUpdateIdentity() {
  return {
    channel: Updates.channel || null,
    runtimeVersion: Updates.runtimeVersion ?? null,
    updateId: Updates.updateId ?? null,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const styles = StyleSheet.create({
  customerStatusBarFill: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 19000, backgroundColor: '#071D49' },
  introOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 20000, elevation: 20000 },
});
