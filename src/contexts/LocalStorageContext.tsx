"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const BASEMAP_STORAGE_KEY = "mdg:basemapId";

interface LocalStorageContextValue {
  // null tant que le localStorage n'a pas encore été lu (SSR / premier rendu)
  basemapId: string | null;
  setBasemapId: (id: string) => void;
}

export const LocalStorageContext = createContext<LocalStorageContextValue>({
  basemapId: null,
  setBasemapId: () => {},
});

export function LocalStorageContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [basemapId, setBasemapIdState] = useState<string | null>(null);

  useEffect(() => {
    // Lecture différée au montage : le localStorage n'existe pas côté serveur.
    const stored = window.localStorage.getItem(BASEMAP_STORAGE_KEY);
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBasemapIdState(stored);
    }
  }, []);

  const setBasemapId = useCallback((id: string) => {
    setBasemapIdState(id);
    window.localStorage.setItem(BASEMAP_STORAGE_KEY, id);
  }, []);

  const value = useMemo(
    () => ({ basemapId, setBasemapId }),
    [basemapId, setBasemapId],
  );

  return (
    <LocalStorageContext.Provider value={value}>
      {children}
    </LocalStorageContext.Provider>
  );
}

export function useLocalStorageContext() {
  return useContext(LocalStorageContext);
}

export default LocalStorageContext;
