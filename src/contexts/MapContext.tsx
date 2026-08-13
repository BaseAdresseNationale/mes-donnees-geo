"use client";

import React, { createContext, useCallback, useMemo, useState } from "react";
import { MapRef } from "react-map-gl/maplibre";

interface MapContextValue {
  mapRef: MapRef | null;
  mapRefCb: (instance: MapRef | null) => void;
  mapChildren: React.ReactNode | null;
  setMapChildren: (children: React.ReactNode) => void;
  mapMessage: string | null;
  setMapMessage: React.Dispatch<React.SetStateAction<string | null>>;
}

export const MapContext = createContext<MapContextValue>({
  mapRef: null,
  mapRefCb: () => {},
  mapChildren: null,
  setMapChildren: () => {},
  mapMessage: null,
  setMapMessage: () => {},
});

export function MapContextProvider(props: { children: React.ReactNode }) {
  const [mapRef, setMapRef] = useState<MapRef | null>(null);
  const mapRefCb = useCallback((node: MapRef | null) => {
    if (node !== null) {
      setMapRef(node);
    }
  }, []);
  const [mapChildren, setMapChildren] = useState<React.ReactNode>(null);

  const [mapMessage, setMapMessage] = useState<string | null>(null);

  const value = useMemo(
    () => ({
      mapRef,
      mapRefCb,
      mapChildren,
      setMapChildren,

      mapMessage,
      setMapMessage,
    }),
    [mapRef, mapRefCb, mapChildren, setMapChildren, mapMessage, setMapMessage],
  );

  return <MapContext.Provider value={value} {...props} />;
}

export default MapContext;
