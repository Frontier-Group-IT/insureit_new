import type { PropsWithChildren } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';

type PartnerSearchValue = {
  query: string;
  setQuery: (value: string) => void;
  clearQuery: () => void;
};

const PartnerSearchContext = createContext<PartnerSearchValue | null>(null);

export function PartnerSearchProvider({ children }: PropsWithChildren) {
  const [query, setQuery] = useState('');

  const value = useMemo(
    () => ({
      query,
      setQuery,
      clearQuery: () => setQuery(''),
    }),
    [query],
  );

  return <PartnerSearchContext.Provider value={value}>{children}</PartnerSearchContext.Provider>;
}

export function usePartnerSearch() {
  const value = useContext(PartnerSearchContext);
  if (!value) throw new Error('usePartnerSearch must be used inside PartnerSearchProvider.');
  return value;
}
