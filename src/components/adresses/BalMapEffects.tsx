"use client";

import { useContext, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import MapContext from "@/contexts/MapContext";
import { useCommune } from "@/contexts/CommuneContext";
import { BalTilesMap } from "@/components/map/bal/BalTilesMap";
import { getBalTab } from "./bal-tab";

// Affiche les tuiles de la BAL sur la carte partagée, avec les couches de
// l'onglet courant, et centre la carte sur la commune à l'arrivée.
export function BalMapEffects({ balId }: { balId: string }) {
  const { setMapChildren, flyToBounds } = useContext(MapContext);
  const { contour: communeContour } = useCommune();

  const tab = getBalTab(usePathname());

  const initialFlyToDoneRef = useRef(false);

  useEffect(() => {
    setMapChildren(<BalTilesMap balId={balId} tab={tab} />);

    return () => {
      setMapChildren(null);
    };
  }, [setMapChildren, balId, tab]);

  useEffect(() => {
    if (!initialFlyToDoneRef.current) {
      if (flyToBounds()) {
        initialFlyToDoneRef.current = true;
      }
    }
  }, [communeContour, flyToBounds]);

  return null;
}
