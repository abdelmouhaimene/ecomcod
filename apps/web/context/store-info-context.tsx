'use client';

import * as React from 'react';
import type { PublicStoreInfo } from '@repo/types';
import { catalogApi } from '../lib/api';

interface StoreInfoContextValue {
  /** null until loaded, and also when the store API is unavailable. */
  store: PublicStoreInfo | null;
  loading: boolean;
  reload: () => void;
}

const StoreInfoContext = React.createContext<StoreInfoContextValue>({
  store: null,
  loading: true,
  reload: () => undefined,
});

/** Loads the dashboard-managed store details once for the header and global footer. */
export function StoreInfoProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = React.useState<PublicStoreInfo | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    let cancelled = false;
    setLoading(true);
    void catalogApi
      .getStore()
      .then((data) => {
        if (!cancelled) setStore(data);
      })
      .catch(() => {
        // Store details are decorative in the chrome; fall back to translations.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(load, [load]);

  const value = React.useMemo(() => ({ store, loading, reload: () => { load(); } }), [load, loading, store]);
  return <StoreInfoContext.Provider value={value}>{children}</StoreInfoContext.Provider>;
}

export function useStoreInfo(): StoreInfoContextValue {
  return React.useContext(StoreInfoContext);
}
