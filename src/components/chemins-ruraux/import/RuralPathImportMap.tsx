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
import type { ExpressionSpecification } from "maplibre-gl";
import type { Feature, FeatureCollection, LineString } from "geojson";
import {
  RuralPathSurface,
  SURFACE_COLORS,
} from "@/components/chemins-ruraux/types";
import type { AssembledRuralPathResponse } from "./types";
import { pathLabel } from "./RuralPathImportBdTopo";
import styles from "./RuralPathImportMap.module.css";

const SOURCE_ID = "chemins-ruraux-import-bd-topo";
const CASING_LAYER_ID = "chemins-ruraux-import-casing";
const LINE_LAYER_ID = "chemins-ruraux-import-line";
const ALREADY_IMPORTED_LAYER_ID = "chemins-ruraux-import-already";

const SURFACE_COLOR_MATCH: ExpressionSpecification = [
  "match",
  ["get", "surface"],
  ...Object.entries(SURFACE_COLORS).flatMap(([surface, color]) => [
    surface,
    color,
  ]),
  "#8a5a2b",
] as unknown as ExpressionSpecification;

type SegmentProperties = {
  key: string;
  label: string;
  surface: RuralPathSurface;
  source: string;
  alreadyImported: boolean;
};

type HoverState = {
  key: string;
  label: string;
  lng: number;
  lat: number;
};

function toFeatures(
  paths: AssembledRuralPathResponse[],
): Feature<LineString, SegmentProperties>[] {
  return paths.flatMap((path) =>
    path.segments.map(
      (seg): Feature<LineString, SegmentProperties> => ({
        type: "Feature",
        properties: {
          key: path.key,
          label: pathLabel(path),
          surface: seg.surface,
          source: seg.source,
          alreadyImported: path.alreadyImported,
        },
        geometry: seg.path,
      }),
    ),
  );
}

export function RuralPathImportMap({
  paths,
  selected,
  hoveredKey,
  onToggle,
}: {
  paths: AssembledRuralPathResponse[];
  selected: Set<string>;
  hoveredKey: string | null;
  onToggle: (key: string) => void;
}) {
  const map = useMap();
  const [hover, setHover] = useState<HoverState | null>(null);

  const importable = useMemo(
    () => paths.filter((p) => !p.alreadyImported),
    [paths],
  );
  const already = useMemo(
    () => paths.filter((p) => p.alreadyImported),
    [paths],
  );

  const featureCollection = useMemo<
    FeatureCollection<LineString, SegmentProperties>
  >(
    () => ({ type: "FeatureCollection", features: toFeatures(importable) }),
    [importable],
  );

  const alreadyImportedCollection = useMemo<
    FeatureCollection<LineString, SegmentProperties>
  >(
    () => ({ type: "FeatureCollection", features: toFeatures(already) }),
    [already],
  );

  useEffect(() => {
    const m = map.current?.getMap();
    if (!m) return;

    const onMove = (e: MapLayerMouseEvent) => {
      const props = e.features?.[0]
        ?.properties as Partial<SegmentProperties> | null;
      if (!props?.key) return;
      m.getCanvas().style.cursor = "pointer";
      setHover({
        key: props.key,
        label: props.label ?? "",
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
      });
    };
    const onLeave = () => {
      m.getCanvas().style.cursor = "";
      setHover(null);
    };
    const onClick = (e: MapLayerMouseEvent) => {
      const key = (
        e.features?.[0]?.properties as Partial<SegmentProperties> | null
      )?.key;
      if (key) onToggle(key);
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
  }, [map, onToggle]);

  const effectiveHoveredKey = hoveredKey ?? hover?.key ?? null;

  return (
    <>
      <Source
        id={`${SOURCE_ID}-already`}
        type="geojson"
        data={alreadyImportedCollection}
      >
        <Layer
          {...({
            id: ALREADY_IMPORTED_LAYER_ID,
            type: "line",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#999999",
              "line-width": 2,
              "line-dasharray": [2, 2],
              "line-opacity": 0.6,
            },
          } as LayerProps)}
        />
      </Source>
      <Source id={SOURCE_ID} type="geojson" data={featureCollection}>
        <Layer
          {...({
            id: CASING_LAYER_ID,
            type: "line",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#ffffff",
              "line-width": [
                "case",
                ["in", ["get", "key"], ["literal", [...selected]]],
                7,
                0,
              ],
              "line-opacity": 0.9,
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
                ["==", ["get", "key"], effectiveHoveredKey ?? ""],
                6,
                ["in", ["get", "key"], ["literal", [...selected]]],
                5,
                3,
              ],
              "line-opacity": [
                "case",
                ["in", ["get", "key"], ["literal", [...selected]]],
                1,
                0.55,
              ],
            },
          } as LayerProps)}
        />
      </Source>
      {hover && (
        <Popup
          longitude={hover.lng}
          latitude={hover.lat}
          closeButton={false}
          closeOnClick={false}
          anchor="bottom"
          offset={14}
          className={styles.popup}
        >
          <div className={styles.popupTitle}>
            {hover.label || "Chemin rural"}
          </div>
        </Popup>
      )}
    </>
  );
}
