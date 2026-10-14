"use client";

import { useContext, useEffect, useRef } from "react";
import { useParams, usePathname } from "next/navigation";
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
  // Sur la page d'une voie, c'est la voie qui est centrée (VoieMapEffects) :
  // le centrage initial sur la commune passerait après et l'écraserait.
  const { voieId } = useParams<{ voieId?: string }>();

  const initialFlyToDoneRef = useRef(false);

  useEffect(() => {
    setMapChildren(<BalTilesMap balId={balId} tab={tab} />);

    return () => {
      setMapChildren(null);
    };
  }, [setMapChildren, balId, tab]);

  useEffect(() => {
    if (voieId) {
      initialFlyToDoneRef.current = true;
    }
    if (!initialFlyToDoneRef.current) {
      if (flyToBounds()) {
        initialFlyToDoneRef.current = true;
      }
    }
  }, [communeContour, flyToBounds, voieId]);

  return null;
}
