"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Feature, MultiPolygon, Polygon } from "geojson";

export type BasemapKind = "openmaptiles" | "ortho" | "ign";

export interface CommuneContextValue {
  codeInsee: string;
  nom: string;
  contour: Feature<Polygon | MultiPolygon> | null;
  enabledPluginIds: string[];
  basemap: BasemapKind;
}

const CommuneContext = createContext<CommuneContextValue | null>(null);

export function CommuneProvider({
  value,
  children,
}: {
  value: CommuneContextValue;
  children: ReactNode;
}) {
  return (
    <CommuneContext.Provider value={value}>{children}</CommuneContext.Provider>
  );
}

export function useCommune(): CommuneContextValue {
  const ctx = useContext(CommuneContext);
  if (!ctx)
    throw new Error(
      "useCommune doit être utilisé à l'intérieur d'un CommuneProvider.",
    );
  return ctx;
}
