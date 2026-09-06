import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

type PartnerNetworkStatus = 'unknown' | 'online' | 'offline';

type PartnerNetworkValue = {
  status: PartnerNetworkStatus;
  isOffline: boolean;
  connectionType: string | null;
};

const PartnerNetworkContext = createContext<PartnerNetworkValue | null>(null);

function resolveStatus(state: NetInfoState): PartnerNetworkStatus {
  if (state.isConnected === false || state.isInternetReachable === false) return 'offline';
  if (state.isConnected === true && state.isInternetReachable !== false) return 'online';
  return 'unknown';
}

export function PartnerNetworkProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<PartnerNetworkStatus>('unknown');
  const [connectionType, setConnectionType] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    void NetInfo.fetch().then((state) => {
      if (!mounted) return;
      setStatus(resolveStatus(state));
      setConnectionType(state.type || null);
    }).catch(() => undefined);

    const unsubscribe = NetInfo.addEventListener((state) => {
      setStatus(resolveStatus(state));
      setConnectionType(state.type || null);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<PartnerNetworkValue>(() => ({
    status,
    isOffline: status === 'offline',
    connectionType,
  }), [status, connectionType]);

  return <PartnerNetworkContext.Provider value={value}>{children}</PartnerNetworkContext.Provider>;
}

export function usePartnerNetwork() {
  const value = useContext(PartnerNetworkContext);
  if (!value) throw new Error('usePartnerNetwork must be used inside PartnerNetworkProvider.');
  return value;
}
