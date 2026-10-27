"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import MapContext from "@/contexts/MapContext";
import { reloadBalTiles } from "@/components/map/bal/BalTilesMap";

// Signal « la BAL a été modifiée » : incrémenté après chaque modification
// réussie (voie, toponyme, numéro), pour recharger ce qui en dépend (tuiles,
// modifications à publier).
const BalChangesContext = createContext<{
  version: number;
  increment: () => void;
}>({ version: 0, increment: () => {} });

export function BalChangesProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const increment = useCallback(() => setVersion((v) => v + 1), []);
  return (
    <BalChangesContext.Provider value={{ version, increment }}>
      {children}
    </BalChangesContext.Provider>
  );
}

// Numéro de version des modifications de la BAL
export function useBalChangesVersion(): number {
  return useContext(BalChangesContext).version;
}

// À appeler après une modification réussie : recharge les tuiles de la carte
// et signale le changement (ex. compteur du bouton « Publier »)
export function useBalChanged() {
  const { mapRef } = useContext(MapContext);
  const { increment } = useContext(BalChangesContext);
  return useCallback(() => {
    reloadBalTiles(mapRef);
    increment();
  }, [mapRef, increment]);
}
