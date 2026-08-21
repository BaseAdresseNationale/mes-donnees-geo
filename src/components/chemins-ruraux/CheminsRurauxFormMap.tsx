"use client";

import { useMemo } from "react";
import { Layer, LayerProps, Source } from "react-map-gl/maplibre";
import type { ExpressionSpecification } from "maplibre-gl";
import type { Feature, FeatureCollection, LineString } from "geojson";
import { SURFACE_COLORS } from "@/components/chemins-ruraux/types";
import { Segment } from "./useCheminsRurauxDrawer";

const EDIT_SOURCE_ID = "chemins-ruraux-edit";
const EDIT_CASING_LAYER_ID = "chemins-ruraux-edit-casing";
const EDIT_LINE_LAYER_ID = "chemins-ruraux-edit-line";

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
}: {
  drawSegments: Segment[];
}) {
  // Aperçu du tracé en cours d'édition (halo blanc + couleur par revêtement).
  const editFeatureCollection = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: "FeatureCollection",
      features: drawSegments.map(
        (seg): Feature<LineString> => ({
          type: "Feature",
          id: seg.id,
          properties: { surface: seg.surface },
          geometry: { type: "LineString", coordinates: seg.coordinates },
        }),
      ),
    }),
    [drawSegments],
  );

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
