"use client";

import { useContext, useEffect, useRef } from "react";
import { Layer, Marker, type MapLayerMouseEvent } from "react-map-gl/maplibre";
import MapContext from "@/contexts/MapContext";
import { getPositionTypeLabel } from "@/lib/api-bal/positions";
import styles from "./NumeroFormMap.module.css";

// Couches sur la source "cadastre" déclarée dans MapLayout
const CADASTRE_SOURCE_ID = "cadastre";
const PARCELLES_SOURCE_LAYER = "parcelles";
const PARCELLES_MIN_ZOOM = 14;
const PARCELLES_CLICK_LAYER_ID = "numero-parcelles-click";
const PARCELLES_SELECTED_LAYER_ID = "numero-parcelles-selected";
const SELECTED_COLOR = "#18753c";

export interface FormPosition {
  // Clé stable côté formulaire (indépendante du rang)
  key: number;
  type: string;
  longitude: number;
  latitude: number;
}

interface NumeroFormMapProps {
  label: string;
  positions: FormPosition[];
  onMovePosition: (key: number, longitude: number, latitude: number) => void;
  parcelles: string[];
  onToggleParcelle: (id: string) => void;
  // Sélection de parcelles active seulement quand le cadastre est affiché
  parcellesSelectable: boolean;
}

// Éléments de carte du formulaire d'un numéro : un marqueur déplaçable par
// position, et sélection des parcelles cadastrales au clic.
export function NumeroFormMap({
  label,
  positions,
  onMovePosition,
  parcelles,
  onToggleParcelle,
  parcellesSelectable,
}: NumeroFormMapProps) {
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
