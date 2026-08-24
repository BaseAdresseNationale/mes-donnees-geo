"use client";

import React, { createContext, useMemo, useState } from "react";

interface DrawContextProviderProps {
  children: React.ReactNode;
}

interface DrawContextValue {
  isDrawing: boolean;
  setIsDrawing: React.Dispatch<React.SetStateAction<boolean>>;
}

export const DrawContext = createContext<DrawContextValue>({
  isDrawing: false,
  setIsDrawing: () => {},
});

export function DrawContextProvider({ children }: DrawContextProviderProps) {
  const [isDrawing, setIsDrawing] = useState(false);

  const value = useMemo(
    () => ({
      isDrawing,
      setIsDrawing,
    }),
    [isDrawing, setIsDrawing],
  );

  return <DrawContext.Provider value={value}>{children}</DrawContext.Provider>;
}

export default DrawContext;
