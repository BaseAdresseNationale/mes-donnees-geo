"use client";

import { RuralPath } from "@/components/chemins-ruraux/types";
import React, { createContext, useMemo, useState } from "react";

interface CheminsRurauxContextProviderProps {
  children: React.ReactNode;
  initialRuralPaths: RuralPath[];
}

interface CheminsRurauxContextValue {
  ruralPaths: RuralPath[];
  setRuralPaths: React.Dispatch<React.SetStateAction<RuralPath[]>>;
  isEditing: boolean;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
}

export const CheminsRurauxContext = createContext<CheminsRurauxContextValue>({
  ruralPaths: [],
  setRuralPaths: () => {},
  isEditing: false,
  setIsEditing: () => {},
});

export function CheminsRurauxContextProvider({
  children,
  initialRuralPaths,
}: CheminsRurauxContextProviderProps) {
  const [ruralPaths, setRuralPaths] = useState(initialRuralPaths);
  const [isEditing, setIsEditing] = useState(false);

  const value = useMemo(
    () => ({ ruralPaths, setRuralPaths, isEditing, setIsEditing }),
    [ruralPaths, setRuralPaths, isEditing, setIsEditing],
  );

  return (
    <CheminsRurauxContext.Provider value={value}>
      {children}
    </CheminsRurauxContext.Provider>
  );
}

export default CheminsRurauxContext;
