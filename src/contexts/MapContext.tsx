"use client";

import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useCommune } from "@/contexts/CommuneContext";
import { MapRef } from "react-map-gl/maplibre";
import { geometryBounds } from "@/lib/geo/bounds";

export const FLY_TO_DURATION_MS = 1500;
export const FLY_TO_PADDING = 64;
export const FLY_TO_MAX_ZOOM = 17;

export enum AvailableDataLayer {
  BAN = "ban",
}

export const availableDataLayerOptions = [
  { value: AvailableDataLayer.BAN, label: "Adresses" },
];

interface MapContextValue {
  mapRef: MapRef | null;
  mapRefCb: (instance: MapRef | null) => void;
  mapChildren: React.ReactNode | null;
  setMapChildren: (children: React.ReactNode) => void;
  mapMessage: string | null;
  setMapMessage: React.Dispatch<React.SetStateAction<string | null>>;
  mapToolChildren: React.ReactNode | null;
  setMapToolChildren: (children: React.ReactNode) => void;
  flyToBounds: (
    bounds?: [[number, number], [number, number]] | null,
  ) => boolean | void;
  savedFlyToBounds: [[number, number], [number, number]] | null;
  setSavedFlyToBounds: React.Dispatch<
    React.SetStateAction<[[number, number], [number, number]] | null>
  >;
  activeDataLayers: AvailableDataLayer[];
  setActiveDataLayers: React.Dispatch<
    React.SetStateAction<AvailableDataLayer[]>
  >;
}

export const MapContext = createContext<MapContextValue>({
  mapRef: null,
  mapRefCb: () => {},
  mapChildren: null,
  setMapChildren: () => {},
  mapMessage: null,
  setMapMessage: () => {},
  mapToolChildren: null,
  setMapToolChildren: () => {},
  flyToBounds: () => {},
  savedFlyToBounds: null,
  setSavedFlyToBounds: () => {},
  activeDataLayers: [],
  setActiveDataLayers: () => {},
});

export function MapContextProvider(props: { children: React.ReactNode }) {
  const [mapRef, setMapRef] = useState<MapRef | null>(null);
  const mapRefCb = useCallback((node: MapRef | null) => {
    if (node !== null) {
      setMapRef(node);
    }
  }, []);
  const [mapChildren, setMapChildren] = useState<React.ReactNode>(null);
  const [mapToolChildren, setMapToolChildren] = useState<React.ReactNode>(null);
  const [mapMessage, setMapMessage] = useState<string | null>(null);
  const [savedFlyToBounds, setSavedFlyToBounds] = useState<
    [[number, number], [number, number]] | null
  >(null);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const [activeDataLayers, setActiveDataLayers] = useState<
    AvailableDataLayer[]
  >([]);
  const { contour: communeContour } = useCommune();

  useEffect(() => {
    if (mapRef && !isStyleLoaded) {
      const onStyleLoad = () => {
        setIsStyleLoaded(true);
      };
      mapRef.getMap().on("style.load", onStyleLoad);
      return () => {
        mapRef.getMap().off("style.load", onStyleLoad);
      };
    }
  }, [mapRef, isStyleLoaded]);

  const flyToBounds = useCallback(
    (bounds?: [[number, number], [number, number]] | null): boolean | void => {
      const m = mapRef?.getMap();
      const communeBounds = communeContour
        ? geometryBounds(communeContour.geometry)
        : null;
      const flyToBounds = bounds || savedFlyToBounds || communeBounds;

      if (!m || !isStyleLoaded || !flyToBounds) {
        return;
      }

      const camera = m.cameraForBounds(flyToBounds, {
        padding: FLY_TO_PADDING,
        maxZoom: FLY_TO_MAX_ZOOM,
      });
      if (!camera) {
        return;
      }

      m.flyTo({
        center: camera.center,
        zoom: camera.zoom,
        maxDuration: FLY_TO_DURATION_MS,
      });

      if (savedFlyToBounds) {
        setSavedFlyToBounds(null);
      }

      return true;
    },
    [mapRef, isStyleLoaded, savedFlyToBounds, communeContour],
  );

  const value = useMemo(
    () => ({
      mapRef,
      mapRefCb,
      mapChildren,
      setMapChildren,
      mapMessage,
      setMapMessage,
      mapToolChildren,
      setMapToolChildren,
      flyToBounds,
      savedFlyToBounds,
      setSavedFlyToBounds,
      activeDataLayers,
      setActiveDataLayers,
    }),
    [
      mapRef,
      mapRefCb,
      mapChildren,
      setMapChildren,
      mapMessage,
      setMapMessage,
      mapToolChildren,
      setMapToolChildren,
      flyToBounds,
      savedFlyToBounds,
      setSavedFlyToBounds,
      activeDataLayers,
      setActiveDataLayers,
    ],
  );

  return <MapContext.Provider value={value} {...props} />;
}

export default MapContext;
