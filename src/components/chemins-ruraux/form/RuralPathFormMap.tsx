"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Layer,
  LayerProps,
  MapLayerMouseEvent,
  Popup,
  Source,
  useMap,
} from "react-map-gl/maplibre";
import { useModals } from "@gouvfr-lasuite/ui-components";
import type { ExpressionSpecification } from "maplibre-gl";
import type { Feature, FeatureCollection, LineString } from "geojson";
import { SURFACE_COLORS } from "@/components/chemins-ruraux/types";
import type { RuralPath } from "@/components/chemins-ruraux/types";
import { Segment } from "../useRuralPathDrawer";
import styles from "./RuralPathFormMap.module.css";

const EDIT_SOURCE_ID = "chemins-ruraux-edit";
const EDIT_CASING_LAYER_ID = "chemins-ruraux-edit-casing";
const EDIT_HOVER_HALO_LAYER_ID = "chemins-ruraux-edit-hover-halo";
const EDIT_LINE_LAYER_ID = "chemins-ruraux-edit-line";
const MERGEABLE_SOURCE_ID = "chemins-ruraux-mergeable";
const MERGEABLE_LINE_LAYER_ID = "chemins-ruraux-mergeable-line";
const MERGEABLE_HITAREA_LAYER_ID = "chemins-ruraux-mergeable-hitarea";

// Couches internes ajoutées par terra-draw-maplibre-gl-adapter (préfixe "td"
// par défaut) : les points de manipulation doivent rester au-dessus.
const TERRA_DRAW_POINT_LAYER_ID = "td-point";
const TERRA_DRAW_POINT_MARKER_LAYER_ID = "td-point-marker";

const SURFACE_COLOR_MATCH: ExpressionSpecification = [
  "match",
  ["get", "surface"],
  ...Object.entries(SURFACE_COLORS).flatMap(([surface, color]) => [
    surface,
    color,
  ]),
  "#4b4bcb",
] as unknown as ExpressionSpecification;

export function CheminsRurauxFormMap({
  drawSegments,
  hoveredSegmentId,
  mergeablePaths,
  onMergePath,
}: {
  drawSegments: Segment[];
  hoveredSegmentId?: string | null;
  mergeablePaths?: RuralPath[];
  onMergePath?: (path: RuralPath) => void;
}) {
  const map = useMap();
  const modals = useModals();
  const [hoveredMergeable, setHoveredMergeable] = useState<{
    pathId: string;
    lng: number;
    lat: number;
  } | null>(null);

  // Aperçu du tracé en cours d'édition (halo blanc + couleur par revêtement).
  const editFeatureCollection = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: "FeatureCollection",
      features: drawSegments.map(
        (seg): Feature<LineString> => ({
          type: "Feature",
          id: seg.id,
          properties: { id: seg.id, surface: seg.surface },
          geometry: { type: "LineString", coordinates: seg.coordinates },
        }),
      ),
    }),
    [drawSegments],
  );

  // Chemins contigus proposés à la fusion, affichés en transparence.
  const mergeableFeatureCollection = useMemo<
    FeatureCollection<LineString, { pathId: string }>
  >(
    () => ({
      type: "FeatureCollection",
      features: (mergeablePaths ?? []).flatMap((p) =>
        p.segments.map(
          (seg): Feature<LineString, { pathId: string }> => ({
            type: "Feature",
            properties: { pathId: p.id },
            geometry: seg.path,
          }),
        ),
      ),
    }),
    [mergeablePaths],
  );

  useEffect(() => {
    const m = map.current?.getMap();
    if (!m || !onMergePath) return;

    const onClick = async (e: MapLayerMouseEvent) => {
      const pathId = (e.features?.[0]?.properties as { pathId?: string } | null)
        ?.pathId;
      const path = mergeablePaths?.find((p) => p.id === pathId);
      if (!path) return;
      const decision = await modals.confirmationModal({
        title: "Fusionner ce chemin ?",
        children: `Fusionner « ${path.nom || "chemin sans nom"} » dans ce chemin ?`,
      });
      if (decision !== "yes") return;
      onMergePath(path);
    };
    const onMove = (e: MapLayerMouseEvent) => {
      const pathId = (e.features?.[0]?.properties as { pathId?: string } | null)
        ?.pathId;
      if (!pathId) return;
      m.getCanvas().style.cursor = "pointer";
      setHoveredMergeable({ pathId, lng: e.lngLat.lng, lat: e.lngLat.lat });
    };
    const onLeave = () => {
      m.getCanvas().style.cursor = "";
      setHoveredMergeable(null);
    };

    m.on("click", MERGEABLE_HITAREA_LAYER_ID, onClick);
    m.on("mousemove", MERGEABLE_HITAREA_LAYER_ID, onMove);
    m.on("mouseleave", MERGEABLE_HITAREA_LAYER_ID, onLeave);
    return () => {
      m.off("click", MERGEABLE_HITAREA_LAYER_ID, onClick);
      m.off("mousemove", MERGEABLE_HITAREA_LAYER_ID, onMove);
      m.off("mouseleave", MERGEABLE_HITAREA_LAYER_ID, onLeave);
    };
  }, [map, mergeablePaths, onMergePath, modals]);

  // Le survol est masqué si le chemin n'est plus proposé à la fusion (fusionné, retiré...).
  const visibleHoveredMergeable =
    hoveredMergeable &&
    mergeableFeatureCollection.features.some(
      (f) => f.properties.pathId === hoveredMergeable.pathId,
    )
      ? hoveredMergeable
      : null;

  // Les couches de terra-draw sont ajoutées de façon asynchrone et
  // indépendante des nôtres : on repasse ses points de manipulation
  // au-dessus à chaque mise à jour du tracé.
  useEffect(() => {
    const m = map.current?.getMap();
    if (!m) return;
    const bringPointsToFront = () => {
      if (m.getLayer(TERRA_DRAW_POINT_MARKER_LAYER_ID)) {
        m.moveLayer(TERRA_DRAW_POINT_MARKER_LAYER_ID);
      }
      if (m.getLayer(TERRA_DRAW_POINT_LAYER_ID)) {
        m.moveLayer(TERRA_DRAW_POINT_LAYER_ID);
      }
    };
    bringPointsToFront();
    const timeout = setTimeout(bringPointsToFront, 50);
    return () => clearTimeout(timeout);
  }, [map, editFeatureCollection]);

  return (
    <>
      <Source
        id={MERGEABLE_SOURCE_ID}
        type="geojson"
        data={mergeableFeatureCollection}
      >
        <Layer
          {...({
            id: MERGEABLE_LINE_LAYER_ID,
            type: "line",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#4b4bcb",
              "line-width": [
                "case",
                [
                  "==",
                  ["get", "pathId"],
                  visibleHoveredMergeable?.pathId ?? "",
                ],
                6,
                4,
              ],
              "line-opacity": [
                "case",
                [
                  "==",
                  ["get", "pathId"],
                  visibleHoveredMergeable?.pathId ?? "",
                ],
                0.85,
                0.4,
              ],
              "line-dasharray": [2, 1.5],
            },
          } as LayerProps)}
        />
        <Layer
          {...({
            id: MERGEABLE_HITAREA_LAYER_ID,
            type: "line",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#000000",
              "line-width": 24,
              "line-opacity": 0,
            },
          } as LayerProps)}
        />
      </Source>
      {visibleHoveredMergeable && (
        <Popup
          longitude={visibleHoveredMergeable.lng}
          latitude={visibleHoveredMergeable.lat}
          closeButton={false}
          closeOnClick={false}
          anchor="bottom"
          offset={14}
          className={styles.mergePopup}
        >
          Chemin contigu, souhaitez-vous le fusionner&nbsp;?
        </Popup>
      )}
      <Source id={EDIT_SOURCE_ID} type="geojson" data={editFeatureCollection}>
        <Layer
          {...({
            id: EDIT_CASING_LAYER_ID,
            type: "line",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#ffffff",
              "line-width": 7,
              "line-opacity": 0.9,
            },
          } as LayerProps)}
        />
        <Layer
          {...({
            id: EDIT_HOVER_HALO_LAYER_ID,
            type: "line",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": SURFACE_COLOR_MATCH,
              "line-blur": 4,
              "line-width": [
                "case",
                ["==", ["get", "id"], hoveredSegmentId ?? ""],
                16,
                0,
              ],
              "line-opacity": [
                "case",
                ["==", ["get", "id"], hoveredSegmentId ?? ""],
                0.5,
                0,
              ],
            },
          } as LayerProps)}
        />
        <Layer
          {...({
            id: EDIT_LINE_LAYER_ID,
            type: "line",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": SURFACE_COLOR_MATCH,
              "line-width": 4,
            },
          } as LayerProps)}
        />
      </Source>
    </>
  );
}
