"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import type { RuralPath } from "@/components/chemins-ruraux/types";
import { useRouter } from "next/navigation";
import {
  Layer,
  LayerProps,
  MapLayerMouseEvent,
  Popup,
  Source,
  useMap,
} from "react-map-gl/maplibre";
import type { ExpressionSpecification } from "maplibre-gl";
import type { FeatureCollection, MultiLineString } from "geojson";
import CheminsRurauxContext from "@/contexts/CheminsRurauxContext";
import { RuralPathStatus } from "@/components/chemins-ruraux/types";
import styles from "./CheminsRurauxMap.module.css";

const SOURCE_ID = "chemins-ruraux";
const LINE_LAYER_ID = "chemins-ruraux-line";
const HALO_LAYER_ID = "chemins-ruraux-halo";

const STATUS_LABEL: Record<RuralPathStatus, string> = {
  [RuralPathStatus.DRAFT]: "Brouillon",
  [RuralPathStatus.PUBLISHED]: "Publié",
  [RuralPathStatus.CERTIFIED]: "Certifié",
};

const STATUS_BADGE_CLASS: Record<RuralPathStatus, string> = {
  [RuralPathStatus.DRAFT]: styles.statusDraft,
  [RuralPathStatus.PUBLISHED]: styles.statusPublished,
  [RuralPathStatus.CERTIFIED]: styles.statusCertified,
};

const STATUS_COLOR_MATCH: ExpressionSpecification = [
  "match",
  ["get", "statut"],
  RuralPathStatus.PUBLISHED,
  "#1e6b2c",
  RuralPathStatus.CERTIFIED,
  "#6e2e63",
  "#4b4bcb",
];

type HoverState = {
  id: string;
  lng: number;
  lat: number;
  nom: string;
  statut: RuralPathStatus;
};

export function CheminsRurauxMap({
  codeCommune,
  ruralPaths,
}: {
  codeCommune: string;
  ruralPaths: RuralPath[];
}) {
  const map = useMap();
  const router = useRouter();
  const { isEditing } = useContext(CheminsRurauxContext);

  const [hover, setHover] = useState<HoverState | null>(null);
  const hoveredIdRef = useRef<string | null>(null);

  const featureCollection = useMemo<FeatureCollection<MultiLineString>>(() => {
    if (isEditing) {
      return { type: "FeatureCollection", features: [] };
    }
    return {
      type: "FeatureCollection",
      features: ruralPaths
        .filter((p): p is typeof p & { path: MultiLineString } =>
          Boolean(p.path),
        )
        .map((p) => ({
          type: "Feature",
          id: p.id,
          properties: { id: p.id, nom: p.nom ?? "", statut: p.statut },
          geometry: p.path,
        })),
    };
  }, [ruralPaths, isEditing]);

  useEffect(() => {
    const m = map.current?.getMap();
    if (!m) return;

    const clearHover = () => {
      const prev = hoveredIdRef.current;
      if (!prev) return;
      m.setFeatureState({ source: SOURCE_ID, id: prev }, { hover: false });
      hoveredIdRef.current = null;
    };

    const setHoveredFeature = (id: string) => {
      if (hoveredIdRef.current === id) return;
      clearHover();
      m.setFeatureState({ source: SOURCE_ID, id }, { hover: true });
      hoveredIdRef.current = id;
    };

    const onMove = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      const id =
        (f.properties?.id as string | undefined) ??
        (f.id != null ? String(f.id) : "");
      if (!id) return;
      setHoveredFeature(id);
      m.getCanvas().style.cursor = "pointer";
      const props = f.properties as {
        nom?: string;
        statut?: RuralPathStatus;
      } | null;
      setHover({
        id,
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
        nom: props?.nom ?? "",
        statut: props?.statut ?? RuralPathStatus.DRAFT,
      });
    };

    const onLeave = () => {
      clearHover();
      m.getCanvas().style.cursor = "";
      setHover(null);
    };

    const onClick = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      const id =
        (f.properties?.id as string | undefined) ??
        (f.id != null ? String(f.id) : "");
      if (!id) return;
      router.push(`/${codeCommune}/chemins-ruraux/${id}`);
    };

    m.on("mousemove", LINE_LAYER_ID, onMove);
    m.on("mouseleave", LINE_LAYER_ID, onLeave);
    m.on("click", LINE_LAYER_ID, onClick);

    return () => {
      m.off("mousemove", LINE_LAYER_ID, onMove);
      m.off("mouseleave", LINE_LAYER_ID, onLeave);
      m.off("click", LINE_LAYER_ID, onClick);
      m.getCanvas().style.cursor = "";
      clearHover();
    };
  }, [map, router, codeCommune]);

  // Le survol est masqué si la feature n'est plus rendue (navigation, suppression).
  const visibleHover =
    hover && featureCollection.features.some((f) => f.id === hover.id)
      ? hover
      : null;

  if (isEditing) return null;

  return (
    <>
      <Source
        id={SOURCE_ID}
        type="geojson"
        data={featureCollection}
        promoteId="id"
      >
        <Layer
          {...({
            id: HALO_LAYER_ID,
            type: "line",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": STATUS_COLOR_MATCH,
              "line-blur": 4,
              "line-width": [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                14,
                0,
              ],
              "line-opacity": [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                0.45,
                0,
              ],
            },
          } as LayerProps)}
        />
        <Layer
          {...({
            id: LINE_LAYER_ID,
            type: "line",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": STATUS_COLOR_MATCH,
              "line-width": [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                5,
                3,
              ],
            },
          } as LayerProps)}
        />
      </Source>
      {visibleHover && (
        <Popup
          longitude={visibleHover.lng}
          latitude={visibleHover.lat}
          closeButton={false}
          closeOnClick={false}
          anchor="bottom"
          offset={14}
          className={styles.popup}
        >
          <div className={styles.popupTitle}>
            {visibleHover.nom.trim() || "Chemin sans nom"}
          </div>
          <span
            className={`${styles.popupStatusBadge} ${STATUS_BADGE_CLASS[visibleHover.statut]}`}
          >
            {STATUS_LABEL[visibleHover.statut]}
          </span>
        </Popup>
      )}
    </>
  );
}
