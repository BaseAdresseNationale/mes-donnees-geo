"use client";

import React, { createContext, useMemo, useState } from "react";

interface PanoramaxContextValue {
  showPanoramax: boolean;
  setShowPanoramax: (show: boolean) => void;
  isDiving: boolean;
  setIsDiving: (diving: boolean) => void;
  // Module route the user came from before opening the viewer, to return there.
  returnPath: string | null;
  setReturnPath: (path: string | null) => void;
}

export const PanoramaxContext = createContext<PanoramaxContextValue>({
  showPanoramax: false,
  setShowPanoramax: () => {},
  isDiving: false,
  setIsDiving: () => {},
  returnPath: null,
  setReturnPath: () => {},
});

export function PanoramaxContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showPanoramax, setShowPanoramax] = useState(false);
  const [isDiving, setIsDiving] = useState(false);
  const [returnPath, setReturnPath] = useState<string | null>(null);

  const value = useMemo(
    () => ({
      showPanoramax,
      setShowPanoramax,
      isDiving,
      setIsDiving,
      returnPath,
      setReturnPath,
    }),
    [showPanoramax, isDiving, returnPath],
  );

  return (
    <PanoramaxContext.Provider value={value}>
      {children}
    </PanoramaxContext.Provider>
  );
}

export default PanoramaxContext;
