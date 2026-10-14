"use client";

import { useContext, useEffect, useRef } from "react";
import {
  Layer,
  Marker,
  Source,
  type MapLayerMouseEvent,
} from "react-map-gl/maplibre";
import MapContext from "@/contexts/MapContext";
import { getPositionTypeLabel } from "@/lib/api-bal/positions";
import type { FormPosition } from "@/components/adresses/form/positions";
import { BAL_TILES_SOURCE_ID } from "./bal.layers";
import styles from "./AddressFormMap.module.css";

// Couches sur la source "cadastre" déclarée dans MapLayout
const CADASTRE_SOURCE_ID = "cadastre";
const PARCELLES_SOURCE_LAYER = "parcelles";
const PARCELLES_MIN_ZOOM = 14;
const PARCELLES_CLICK_LAYER_ID = "form-parcelles-click";
const PARCELLES_SELECTED_LAYER_ID = "form-parcelles-selected";
const SELECTED_COLOR = "#18753c";

// Contour dessiné et numéros mis en évidence (association à un toponyme)
const POLYGON_SOURCE_ID = "form-polygon";
const HIGHLIGHT_LAYER_ID = "form-numeros-highlighted";
const HIGHLIGHT_COLOR = "#e1000f";

interface AddressFormMapProps {
  label: string;
  positions: FormPosition[];
  onMovePosition: (key: number, longitude: number, latitude: number) => void;
  parcelles: string[];
  onToggleParcelle: (id: string) => void;
  // Sélection de parcelles active seulement quand le cadastre est affiché
  parcellesSelectable: boolean;
  // Contour [[lon, lat], …] à afficher (ex. sélection de numéros)
  polygon?: number[][] | null;
  // Numéros des tuiles BAL à mettre en évidence
  highlightedNumeroIds?: string[];
}

// Éléments de carte des formulaires voie / numéro / toponyme : un marqueur
// déplaçable par position, sélection des parcelles cadastrales au clic, et
// éventuellement un contour et des numéros mis en évidence.
export function AddressFormMap({
  label,
  positions,
  onMovePosition,
  parcelles,
  onToggleParcelle,
  parcellesSelectable,
  polygon,
  highlightedNumeroIds,
}: AddressFormMapProps) {
  const { mapRef } = useContext(MapContext);

  // Dernier callback sans ré-abonner les événements à chaque rendu
  const onToggleRef = useRef(onToggleParcelle);
  useEffect(() => {
    onToggleRef.current = onToggleParcelle;
  }, [onToggleParcelle]);

  useEffect(() => {
    if (!mapRef || !parcellesSelectable) return;

    const handleClick = (e: MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === "string") onToggleRef.current(id);
    };
    const handleEnter = () => {
      mapRef.getCanvas().style.cursor = "pointer";
    };
    const handleLeave = () => {
      mapRef.getCanvas().style.cursor = "";
    };

    mapRef.on("click", PARCELLES_CLICK_LAYER_ID, handleClick);
    mapRef.on("mouseenter", PARCELLES_CLICK_LAYER_ID, handleEnter);
    mapRef.on("mouseleave", PARCELLES_CLICK_LAYER_ID, handleLeave);
    return () => {
      mapRef.off("click", PARCELLES_CLICK_LAYER_ID, handleClick);
      mapRef.off("mouseenter", PARCELLES_CLICK_LAYER_ID, handleEnter);
      mapRef.off("mouseleave", PARCELLES_CLICK_LAYER_ID, handleLeave);
      handleLeave();
    };
  }, [mapRef, parcellesSelectable]);

  return (
    <>
      {/* Parcelles sélectionnées */}
      <Layer
        id={PARCELLES_SELECTED_LAYER_ID}
        type="fill"
        source={CADASTRE_SOURCE_ID}
        source-layer={PARCELLES_SOURCE_LAYER}
        minzoom={PARCELLES_MIN_ZOOM}
        filter={["in", ["get", "id"], ["literal", parcelles]]}
        paint={{
          "fill-color": SELECTED_COLOR,
          "fill-opacity": 0.4,
          "fill-outline-color": SELECTED_COLOR,
        }}
      />
      {/* Cible invisible des clics sur les parcelles */}
      <Layer
        id={PARCELLES_CLICK_LAYER_ID}
        type="fill"
        source={CADASTRE_SOURCE_ID}
        source-layer={PARCELLES_SOURCE_LAYER}
        minzoom={PARCELLES_MIN_ZOOM}
        layout={{ visibility: parcellesSelectable ? "visible" : "none" }}
        paint={{ "fill-color": "#000", "fill-opacity": 0 }}
      />

      {polygon && polygon.length >= 4 && (
        <Source
          id={POLYGON_SOURCE_ID}
          type="geojson"
          data={{
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [polygon] },
          }}
        >
          <Layer
            id={`${POLYGON_SOURCE_ID}-fill`}
            type="fill"
            paint={{ "fill-color": HIGHLIGHT_COLOR, "fill-opacity": 0.08 }}
          />
          <Layer
            id={`${POLYGON_SOURCE_ID}-line`}
            type="line"
            paint={{
              "line-color": HIGHLIGHT_COLOR,
              "line-width": 2,
              "line-dasharray": [2, 1],
            }}
          />
        </Source>
      )}

      {highlightedNumeroIds && highlightedNumeroIds.length > 0 && (
        <Layer
          id={HIGHLIGHT_LAYER_ID}
          type="circle"
          source={BAL_TILES_SOURCE_ID}
          source-layer="numeros-points"
          filter={["in", ["get", "id"], ["literal", highlightedNumeroIds]]}
          paint={{
            "circle-radius": 7,
            "circle-color": HIGHLIGHT_COLOR,
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 2,
          }}
        />
      )}

      {/* Positions : poignées déplaçables */}
      {positions.map((position) => (
        <Marker
          key={position.key}
          longitude={position.longitude}
          latitude={position.latitude}
          anchor="bottom"
          draggable
          onDragEnd={(e) =>
            onMovePosition(position.key, e.lngLat.lng, e.lngLat.lat)
          }
        >
          <div className={styles.marker}>
            <span className={styles.markerLabel}>
              {label} · {getPositionTypeLabel(position.type)}
            </span>
            <span className={styles.markerPin} />
          </div>
        </Marker>
      ))}
    </>
  );
}
