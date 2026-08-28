import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  getCurrentSession,
  type PartnerSessionContext,
  resolvePartnerSession,
  signOut as signOutFromSupabase,
} from '@/lib/partner-session';

type SessionStatus = 'loading' | 'signed_out' | 'ready' | 'denied';

type PartnerSessionValue = {
  status: SessionStatus;
  context: PartnerSessionContext | null;
  error: string | null;
  refresh: () => Promise<PartnerSessionContext | null>;
  clear: () => void;
  signOut: () => Promise<void>;
};

const PartnerSessionContextValue = createContext<PartnerSessionValue | null>(null);

export function PartnerSessionProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [context, setContext] = useState<PartnerSessionContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const session = await getCurrentSession();
      if (!session?.user) {
        setContext(null);
        setStatus('signed_out');
        return null;
      }

      const nextContext = await resolvePartnerSession();
      setContext(nextContext);
      setStatus('ready');
      return nextContext;
    } catch (cause) {
      setContext(null);
      setError(cause instanceof Error ? cause.message : 'Partner access could not be resolved.');
      setStatus('denied');
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clear = useCallback(() => {
    setContext(null);
    setError(null);
    setStatus('signed_out');
  }, []);

  const signOut = useCallback(async () => {
    try {
      await signOutFromSupabase();
    } finally {
      clear();
    }
  }, [clear]);

  const value = useMemo(
    () => ({ status, context, error, refresh, clear, signOut }),
    [status, context, error, refresh, clear, signOut],
  );

  return <PartnerSessionContextValue.Provider value={value}>{children}</PartnerSessionContextValue.Provider>;
}

export function usePartnerSession() {
  const value = useContext(PartnerSessionContextValue);
  if (!value) throw new Error('usePartnerSession must be used inside PartnerSessionProvider.');
  return value;
}
