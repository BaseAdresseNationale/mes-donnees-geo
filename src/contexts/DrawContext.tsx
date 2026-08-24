"use client";

import type { Segment } from "@/components/chemins-ruraux/useRuralPathDrawer";
import React, { createContext, useMemo, useState } from "react";

interface DrawContextProviderProps {
  children: React.ReactNode;
}

interface DrawContextValue {
  isDrawing: boolean;
  setIsDrawing: React.Dispatch<React.SetStateAction<boolean>>;
  drawSegments: Segment[];
  setDrawSegments: React.Dispatch<React.SetStateAction<Segment[]>>;
}

export const DrawContext = createContext<DrawContextValue>({
  isDrawing: false,
  setIsDrawing: () => {},
  drawSegments: [],
  setDrawSegments: () => {},
});

export function DrawContextProvider({ children }: DrawContextProviderProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawSegments, setDrawSegments] = useState<Segment[]>([]);

  const value = useMemo(
    () => ({
      isDrawing,
      setIsDrawing,
      drawSegments,
      setDrawSegments,
    }),
    [isDrawing, setIsDrawing, drawSegments, setDrawSegments],
  );

  return <DrawContext.Provider value={value}>{children}</DrawContext.Provider>;
}

export default DrawContext;
