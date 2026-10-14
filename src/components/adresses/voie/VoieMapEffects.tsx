"use client";

import { useContext, useEffect, useRef } from "react";
import MapContext from "@/contexts/MapContext";

// Centre la carte sur la voie (bbox calculée par l'API à partir de son tracé
// ou de ses numéros ; null si elle n'a ni l'un ni l'autre).
export function VoieMapEffects({ bbox }: { bbox: number[] | null }) {
  const { flyToBounds } = useContext(MapContext);

  // Bbox déjà centrée : on ne recentre pas à chaque rendu
  const flownBboxRef = useRef<string | null>(null);

  useEffect(() => {
    if (!bbox || bbox.length !== 4) return;

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
