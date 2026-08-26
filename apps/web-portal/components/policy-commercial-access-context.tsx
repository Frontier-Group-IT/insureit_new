"use client";

import { createContext, useContext, type ReactNode } from "react";

const PolicyCommercialAccessContext = createContext(false);

export function PolicyCommercialAccessProvider({ access, children }: { access: boolean; children: ReactNode }) {
  return <PolicyCommercialAccessContext.Provider value={access}>{children}</PolicyCommercialAccessContext.Provider>;
}

export function usePolicyCommercialAccess() {
  return useContext(PolicyCommercialAccessContext);
}
