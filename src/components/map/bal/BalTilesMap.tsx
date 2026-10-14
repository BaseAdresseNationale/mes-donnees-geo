"use client";

import { useContext, useEffect, useRef } from "react";
import {
  Layer,
  MapLayerMouseEvent,
  MapRef,
  Source,
} from "react-map-gl/maplibre";
import type { FilterSpecification, VectorTileSource } from "maplibre-gl";
import MapContext from "@/contexts/MapContext";
import DrawContext from "@/contexts/DrawContext";
import {
  BAL_TILES_MAX_ZOOM,
  BAL_TILES_MIN_ZOOM,
  BAL_TILES_SOURCE_ID,
  BAL_LAYER_IDS,
  BAL_NUMERO_LAYER_IDS,
  getBalLayers,
} from "./bal.layers";
import type { BalTab } from "@/components/adresses/bal-tab";

// La route de tuiles de mes-adresses-api est publique : le navigateur
// l'appelle directement, sans passer par le proxy /api/adresses.
function balTilesUrl(balId: string): string {
  const apiUrl = (process.env.NEXT_PUBLIC_MES_ADRESSES_API_URL ?? "").replace(
    /\/+$/,
    "",
  );
  return `${apiUrl}/v2/bases-locales/${balId}/tiles/{z}/{x}/{y}.pbf`;
}

// Force le rechargement des tuiles de la BAL (ex. après la modification
// d'une voie) : l'API les génère à la volée, il suffit de les redemander.
export function reloadBalTiles(mapRef: MapRef | null) {
  const source = mapRef
    ?.getMap()
    .getSource<VectorTileSource>(BAL_TILES_SOURCE_ID);
  if (source?.tiles) {
    source.setTiles(source.tiles);
  }
}

export function BalTilesMap({
  balId,
  tab,
  hiddenNumeroId,
}: {
  balId: string;
  tab: BalTab;
  // Numéro en cours d'édition : représenté par ses marqueurs déplaçables,
  // on ne l'affiche pas en double depuis les tuiles.
  hiddenNumeroId?: string;
}) {
  const { mapRef } = useContext(MapContext);
  const { isDrawing } = useContext(DrawContext);

  const hoveredStateId = useRef<{
    id: string;
    source: string;
    sourceLayer: string;
  } | null>(null);

  // Survol : mise en évidence de l'entité via le feature-state "hover"
  useEffect(() => {
    if (!mapRef || isDrawing) {
      return;
    }

    const clearHover = () => {
      if (hoveredStateId.current) {
        mapRef.setFeatureState(hoveredStateId.current, { hover: false });
        hoveredStateId.current = null;
      }
    };

    const handleMouseMove = (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) {
        return;
      }

      clearHover();
      hoveredStateId.current = {
        id: feature.id as string,
        source: feature.source,
        sourceLayer: feature.sourceLayer as string,
      };
      mapRef.setFeatureState(hoveredStateId.current, { hover: true });
      mapRef.getCanvas().style.cursor = "pointer";
    };

    const handleMouseLeave = () => {
      clearHover();
      mapRef.getCanvas().style.cursor = "";
    };

    // Les couches masquées ne déclenchent pas d'événement : on peut écouter
    // toutes les couches quel que soit l'onglet.
    BAL_LAYER_IDS.forEach((id) => {
      mapRef.on("mousemove", id, handleMouseMove);
      mapRef.on("mouseleave", id, handleMouseLeave);
    });

    return () => {
      BAL_LAYER_IDS.forEach((id) => {
        mapRef.off("mousemove", id, handleMouseMove);
        mapRef.off("mouseleave", id, handleMouseLeave);
      });
      handleMouseLeave();
    };
  }, [mapRef, isDrawing, balId]);

  return (
    <Source
      // Nouvelle source à chaque BAL pour ne pas garder les tuiles précédentes
      key={balId}
      id={BAL_TILES_SOURCE_ID}
      type="vector"
      tiles={[balTilesUrl(balId)]}
      minzoom={BAL_TILES_MIN_ZOOM}
      maxzoom={BAL_TILES_MAX_ZOOM}
      promoteId="id"
    >
      {getBalLayers(tab).map((layer) => {
        // Le filtre n'est ajouté qu'aux couches concernées : une clé `filter`
        // à undefined est refusée par maplibre à la création de la couche.
        const hideNumero =
          hiddenNumeroId !== undefined &&
          BAL_NUMERO_LAYER_IDS.includes(layer.id!);
        return (
          <Layer
            key={layer.id}
            {...layer}
            {...(hideNumero
              ? {
                  filter: [
                    "!=",
                    ["get", "id"],
                    hiddenNumeroId,
                  ] as FilterSpecification,
                }
              : {})}
          />
        );
      })}
    </Source>
  );
}
