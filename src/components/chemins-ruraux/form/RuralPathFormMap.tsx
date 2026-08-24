"use client";

import { useEffect, useMemo } from "react";
import { Layer, LayerProps, Source, useMap } from "react-map-gl/maplibre";
import type { ExpressionSpecification } from "maplibre-gl";
import type { Feature, FeatureCollection, LineString } from "geojson";
import { SURFACE_COLORS } from "@/components/chemins-ruraux/types";
import { Segment } from "../useRuralPathDrawer";

const EDIT_SOURCE_ID = "chemins-ruraux-edit";
const EDIT_CASING_LAYER_ID = "chemins-ruraux-edit-casing";
const EDIT_HOVER_HALO_LAYER_ID = "chemins-ruraux-edit-hover-halo";
const EDIT_LINE_LAYER_ID = "chemins-ruraux-edit-line";

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
}: {
  drawSegments: Segment[];
  hoveredSegmentId?: string | null;
}) {
  const map = useMap();

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
  );
}
