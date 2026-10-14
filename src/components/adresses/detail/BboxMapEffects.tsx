"use client";

import { useContext, useEffect, useRef } from "react";
import MapContext from "@/contexts/MapContext";

// Centre la carte sur la bbox [minLng, minLat, maxLng, maxLat] d'une voie ou
// d'un toponyme, calculée par l'API (absente si l'entité n'a pas de géométrie).
function isBbox(value: unknown): value is [number, number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((n) => typeof n === "number")
  );
}

export function BboxMapEffects({ bbox }: { bbox: unknown }) {
  const { flyToBounds } = useContext(MapContext);

  // Bbox déjà centrée : on ne recentre pas à chaque rendu
  const flownBboxRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isBbox(bbox)) return;

    const key = bbox.join(",");
    if (flownBboxRef.current === key) return;

    const [minLng, minLat, maxLng, maxLat] = bbox;
    // flyToBounds renvoie undefined tant que le style de la carte n'est pas
    // chargé : l'effet sera rejoué quand flyToBounds changera.
    if (
      flyToBounds([
        [minLng, minLat],
        [maxLng, maxLat],
      ])
    ) {
      flownBboxRef.current = key;
    }
  }, [bbox, flyToBounds]);

  return null;
}
