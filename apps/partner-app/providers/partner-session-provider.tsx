import type { PropsWithChildren } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { unregisterPartnerPushDevice } from '@/lib/partner-notifications';
import { clearPartnerQueryCache } from '@/lib/partner-query-cache';
import {
  getCurrentSession,
  type PartnerSessionContext,
  resolvePartnerSession,
  signOut as signOutFromSupabase,
} from '@/lib/partner-session';
import { supabase } from '@/lib/supabase';

type SessionStatus = 'loading' | 'signed_out' | 'ready' | 'denied';

type PartnerSessionValue = {
  status: SessionStatus;
  context: PartnerSessionContext | null;
  error: string | null;
  cacheScopeKey: string;
  refresh: () => Promise<PartnerSessionContext | null>;
  clear: () => void;
  signOut: () => Promise<void>;
};

const PartnerSessionContextValue = createContext<PartnerSessionValue | null>(null);
const FOREGROUND_SCOPE_REFRESH_MS = 5 * 60 * 1000;

export function PartnerSessionProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [context, setContext] = useState<PartnerSessionContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastResolvedAt = useRef(0);
  const activeScopeKey = useRef('signed-out');
  const contextRef = useRef<PartnerSessionContext | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const resolve = useCallback(async ({ blocking }: { blocking: boolean }) => {
    if (blocking) setStatus('loading');
    setError(null);

    try {
      const session = await getCurrentSession();
      if (!session?.user) {
        clearPartnerQueryCache(activeScopeKey.current);
        activeScopeKey.current = 'signed-out';
        contextRef.current = null;
        setContext(null);
        setStatus('signed_out');
        return null;
      }

      const nextScopeKey = session.user.id;
      if (activeScopeKey.current !== nextScopeKey) {
        clearPartnerQueryCache(activeScopeKey.current);
        activeScopeKey.current = nextScopeKey;
      }

      const nextContext = await resolvePartnerSession();
      contextRef.current = nextContext;
      setContext(nextContext);
      setStatus('ready');
      lastResolvedAt.current = Date.now();
      return nextContext;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Partner access could not be resolved.';

      if (!blocking && contextRef.current) {
        setError(message);
        setStatus('ready');
        return contextRef.current;
      }

      clearPartnerQueryCache(activeScopeKey.current);
      contextRef.current = null;
      setContext(null);
      setError(message);
      setStatus('denied');
      return null;
    }
  }, []);

  const refresh = useCallback(() => resolve({ blocking: true }), [resolve]);

  const clear = useCallback(() => {
    clearPartnerQueryCache(activeScopeKey.current);
    activeScopeKey.current = 'signed-out';
    contextRef.current = null;
    setContext(null);
    setError(null);
    setStatus('signed_out');
    lastResolvedAt.current = 0;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await unregisterPartnerPushDevice();
      await signOutFromSupabase();
    } finally {
      clear();
    }
  }, [clear]);

  useEffect(() => {
    void resolve({ blocking: true });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        clear();
        return;
      }

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        setTimeout(() => {
          void resolve({ blocking: !contextRef.current });
        }, 0);
      }
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      const previous = appState.current;
      appState.current = nextState;

      if (nextState === 'active') {
        supabase.auth.startAutoRefresh();

        const backgrounded = previous === 'background' || previous === 'inactive';
        const staleScope = Date.now() - lastResolvedAt.current >= FOREGROUND_SCOPE_REFRESH_MS;
        if (backgrounded && staleScope) {
          void resolve({ blocking: false });
        }
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();

    return () => {
      authListener.subscription.unsubscribe();
      appStateSubscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, [clear, resolve]);

  const cacheScopeKey = context?.identity.auth_user_id || activeScopeKey.current;

  const value = useMemo(
    () => ({ status, context, error, cacheScopeKey, refresh, clear, signOut }),
    [status, context, error, cacheScopeKey, refresh, clear, signOut],
  );

  return <PartnerSessionContextValue.Provider value={value}>{children}</PartnerSessionContextValue.Provider>;
}

export function usePartnerSession() {
  const value = useContext(PartnerSessionContextValue);
  if (!value) throw new Error('usePartnerSession must be used inside PartnerSessionProvider.');
  return value;
}
