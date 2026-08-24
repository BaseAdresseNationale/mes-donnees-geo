"use client";

import React, { createContext, useMemo, useState } from "react";

interface PanoramaxContextValue {
  showPanoramax: boolean;
  setShowPanoramax: (show: boolean) => void;
  isDiving: boolean;
  setIsDiving: (diving: boolean) => void;
}

export const PanoramaxContext = createContext<PanoramaxContextValue>({
  showPanoramax: false,
  setShowPanoramax: () => {},
  isDiving: false,
  setIsDiving: () => {},
});

export function PanoramaxContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showPanoramax, setShowPanoramax] = useState(false);
  const [isDiving, setIsDiving] = useState(false);

  const value = useMemo(
    () => ({
      showPanoramax,
      setShowPanoramax,
      isDiving,
      setIsDiving,
    }),
    [showPanoramax, isDiving],
  );

  return (
    <PanoramaxContext.Provider value={value}>
      {children}
    </PanoramaxContext.Provider>
  );
}

export default PanoramaxContext;
