"use client";

import { useEffect, useMemo, useState } from "react";
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
import type { Feature, FeatureCollection, LineString } from "geojson";
import {
  RuralPathStatus,
  SURFACE_COLORS,
} from "@/components/chemins-ruraux/types";
import styles from "./RuralPathsListMap.module.css";

const SOURCE_ID = "chemins-ruraux";
const LINE_LAYER_ID = "chemins-ruraux-line";
const HOVER_HALO_LAYER_ID = "chemins-ruraux-hover-halo";
const CASING_LAYER_ID = "chemins-ruraux-casing";

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

const SURFACE_COLOR_MATCH: ExpressionSpecification = [
  "match",
  ["get", "surface"],
  ...Object.entries(SURFACE_COLORS).flatMap(([surface, color]) => [
    surface,
    color,
  ]),
  "#4b4bcb",
] as unknown as ExpressionSpecification;

type SegmentProperties = {
  pathId: string;
  nom: string;
  statut: RuralPathStatus;
  surface: string;
};

type HoverState = {
  pathId: string;
  lng: number;
  lat: number;
  nom: string;
  statut: RuralPathStatus;
};

export function CheminsRurauxListMap({
  codeCommune,
  ruralPaths,
  hoveredPathId,
}: {
  codeCommune: string;
  ruralPaths: RuralPath[];
  hoveredPathId?: string | null;
}) {
  const map = useMap();
  const router = useRouter();

  const [hover, setHover] = useState<HoverState | null>(null);

  // Un feature par segment (pas par chemin) pour pouvoir colorer chaque
  // tronçon selon son propre revêtement.
  const featureCollection = useMemo<
    FeatureCollection<LineString, SegmentProperties>
  >(() => {
    return {
      type: "FeatureCollection",
      features: ruralPaths.flatMap((p) =>
        p.segments.map(
          (seg): Feature<LineString, SegmentProperties> => ({
            type: "Feature",
            id: seg.id,
            properties: {
              pathId: p.id,
              nom: p.nom ?? "",
              statut: p.statut,
              surface: seg.surface,
            },
            geometry: seg.path,
          }),
        ),
      ),
    };
  }, [ruralPaths]);

  // Survol : celui pilotable depuis la liste (prop) prévaut sur celui détecté
  // au survol de la carte elle-même.
  const effectiveHoveredPathId = hoveredPathId ?? hover?.pathId ?? null;

  useEffect(() => {
    const m = map.current?.getMap();
    if (!m) return;

    const onMove = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      const props = f.properties as Partial<SegmentProperties> | null;
      const pathId = props?.pathId;
      if (!pathId) return;
      m.getCanvas().style.cursor = "pointer";
      setHover({
        pathId,
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
        nom: props?.nom ?? "",
        statut: props?.statut ?? RuralPathStatus.DRAFT,
      });
    };

    const onLeave = () => {
      m.getCanvas().style.cursor = "";
      setHover(null);
    };

    const onClick = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      const props = f.properties as Partial<SegmentProperties> | null;
      if (!props?.pathId) return;
      router.push(`/${codeCommune}/chemins-ruraux/${props.pathId}`);
    };

    m.on("mousemove", LINE_LAYER_ID, onMove);
    m.on("mouseleave", LINE_LAYER_ID, onLeave);
    m.on("click", LINE_LAYER_ID, onClick);

    return () => {
      m.off("mousemove", LINE_LAYER_ID, onMove);
      m.off("mouseleave", LINE_LAYER_ID, onLeave);
      m.off("click", LINE_LAYER_ID, onClick);
      m.getCanvas().style.cursor = "";
    };
  }, [map, router, codeCommune]);

  // Le survol est masqué si la feature n'est plus rendue (navigation, suppression).
  const visibleHover =
    hover &&
    !hoveredPathId &&
    featureCollection.features.some((f) => f.properties.pathId === hover.pathId)
      ? hover
      : null;

  return (
    <>
      <Source id={SOURCE_ID} type="geojson" data={featureCollection}>
        <Layer
          {...({
            id: CASING_LAYER_ID,
            type: "line",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#ffffff",
              "line-width": 5,
              "line-opacity": 0.9,
            },
          } as LayerProps)}
        />
        <Layer
          {...({
            id: HOVER_HALO_LAYER_ID,
            type: "line",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": SURFACE_COLOR_MATCH,
              "line-blur": 4,
              "line-width": [
                "case",
                ["==", ["get", "pathId"], effectiveHoveredPathId ?? ""],
                14,
                0,
              ],
              "line-opacity": [
                "case",
                ["==", ["get", "pathId"], effectiveHoveredPathId ?? ""],
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
              "line-color": SURFACE_COLOR_MATCH,
              "line-width": [
                "case",
                ["==", ["get", "pathId"], effectiveHoveredPathId ?? ""],
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
