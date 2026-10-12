"use client";

import { useContext, useEffect, useRef } from "react";
import MapContext from "@/contexts/MapContext";
import { useCommune } from "@/contexts/CommuneContext";
import { BalTilesMap } from "@/components/map/bal/BalTilesMap";

// Affiche les tuiles de la BAL sur la carte partagée et centre la carte
// sur la commune à l'arrivée sur le plugin.
export function BalMapEffects({ balId }: { balId: string }) {
  const { setMapChildren, flyToBounds } = useContext(MapContext);
  const { contour: communeContour } = useCommune();

  const initialFlyToDoneRef = useRef(false);

  useEffect(() => {
    setMapChildren(<BalTilesMap balId={balId} />);

    return () => {
      setMapChildren(null);
    };
  }, [setMapChildren, balId]);

  useEffect(() => {
    if (!initialFlyToDoneRef.current) {
      if (flyToBounds()) {
        initialFlyToDoneRef.current = true;
      }
    }
  }, [communeContour, flyToBounds]);

  return null;
}
