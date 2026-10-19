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

  const pathname = usePathname();
  const tab = getBalTab(pathname);
  // Sur la page d'une voie ou d'un toponyme, c'est lui qui est centré
  // (BboxMapEffects) : le centrage initial sur la commune passerait après et
  // l'écraserait.
  const { voieId, toponymeId, numeroId } = useParams<{
    voieId?: string;
    toponymeId?: string;
    numeroId?: string;
  }>();
  const hasDetailTarget = Boolean(voieId || toponymeId || numeroId);
  // Formulaire de la voie : son tracé est édité sur la carte
  const editedVoieId =
    voieId && !numeroId && pathname.endsWith("/edit") ? voieId : undefined;

  const initialFlyToDoneRef = useRef(false);

  useEffect(() => {
    setMapChildren(
      <BalTilesMap
        balId={balId}
        tab={tab}
        hiddenNumeroId={numeroId}
        hiddenVoieId={editedVoieId}
      />,
    );

    return () => {
      setMapChildren(null);
    };
  }, [setMapChildren, balId, tab, numeroId, editedVoieId]);

  useEffect(() => {
    if (hasDetailTarget) {
      initialFlyToDoneRef.current = true;
    }
    if (!initialFlyToDoneRef.current) {
      if (flyToBounds()) {
        initialFlyToDoneRef.current = true;
      }
    }
  }, [communeContour, flyToBounds, hasDetailTarget]);

  return null;
}
