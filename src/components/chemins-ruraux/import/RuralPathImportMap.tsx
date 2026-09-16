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
import { RuralPathClassement } from "@/generated/prisma/browser";
import { CLASSEMENT_LABELS } from "@/components/chemins-ruraux/types";
import type { BdTopoCandidateResponse } from "./types";
import styles from "./RuralPathImportMap.module.css";

const SOURCE_ID = "chemins-ruraux-import-bd-topo";
const CASING_LAYER_ID = "chemins-ruraux-import-casing";
const LINE_LAYER_ID = "chemins-ruraux-import-line";
const ALREADY_IMPORTED_LAYER_ID = "chemins-ruraux-import-already";

const CLASSEMENT_COLOR_MATCH: ExpressionSpecification = [
  "match",
  ["get", "classement"],
  RuralPathClassement.CHEMIN_RURAL,
  "#3f8a3f",
  RuralPathClassement.VOIE_COMMUNALE,
  "#2b6cb0",
  "#8a5a2b",
] as unknown as ExpressionSpecification;

type CandidateProperties = {
  cleabs: string;
  nature: string;
  nomVoie: string;
  classement: RuralPathClassement;
  alreadyImported: boolean;
};

type HoverState = {
  cleabs: string;
  lng: number;
  lat: number;
  nature: string;
  nomVoie: string;
};

export function RuralPathImportMap({
  candidates,
  selected,
  hoveredCleabs,
  onToggle,
}: {
  candidates: BdTopoCandidateResponse[];
  selected: Set<string>;
  hoveredCleabs: string | null;
  onToggle: (cleabs: string) => void;
}) {
  const map = useMap();
  const [hover, setHover] = useState<HoverState | null>(null);

  const importable = useMemo(
    () => candidates.filter((c) => !c.alreadyImported),
    [candidates],
  );
  const already = useMemo(
    () => candidates.filter((c) => c.alreadyImported),
    [candidates],
  );

  const featureCollection = useMemo<
    FeatureCollection<LineString, CandidateProperties>
  >(
    () => ({
      type: "FeatureCollection",
      features: importable.map(
        (c): Feature<LineString, CandidateProperties> => ({
          type: "Feature",
          properties: {
            cleabs: c.cleabs,
            nature: c.nature,
            nomVoie: c.nomVoie ?? "",
            classement: c.suggestedClassement,
            alreadyImported: false,
          },
          geometry: c.path,
        }),
      ),
    }),
    [importable],
  );

  const alreadyImportedCollection = useMemo<
    FeatureCollection<LineString, CandidateProperties>
  >(
    () => ({
      type: "FeatureCollection",
      features: already.map(
        (c): Feature<LineString, CandidateProperties> => ({
          type: "Feature",
          properties: {
            cleabs: c.cleabs,
            nature: c.nature,
            nomVoie: c.nomVoie ?? "",
            classement: c.suggestedClassement,
            alreadyImported: true,
          },
          geometry: c.path,
        }),
      ),
    }),
    [already],
  );

  useEffect(() => {
    const m = map.current?.getMap();
    if (!m) return;

    const onMove = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      const props = f?.properties as Partial<CandidateProperties> | null;
      if (!props?.cleabs) return;
      m.getCanvas().style.cursor = "pointer";
      setHover({
        cleabs: props.cleabs,
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
        nature: props.nature ?? "",
        nomVoie: props.nomVoie ?? "",
      });
    };
    const onLeave = () => {
      m.getCanvas().style.cursor = "";
      setHover(null);
    };
    const onClick = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      const cleabs = (f?.properties as Partial<CandidateProperties> | null)
        ?.cleabs;
      if (cleabs) onToggle(cleabs);
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

  const effectiveHoveredCleabs = hoveredCleabs ?? hover?.cleabs ?? null;

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
                ["in", ["get", "cleabs"], ["literal", [...selected]]],
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
              "line-color": CLASSEMENT_COLOR_MATCH,
              "line-width": [
                "case",
                ["==", ["get", "cleabs"], effectiveHoveredCleabs ?? ""],
                6,
                ["in", ["get", "cleabs"], ["literal", [...selected]]],
                5,
                3,
              ],
              "line-opacity": [
                "case",
                ["in", ["get", "cleabs"], ["literal", [...selected]]],
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
            {hover.nomVoie.trim() || "Voie sans nom"}
          </div>
          <div className={styles.popupMeta}>
            {hover.nature} ·{" "}
            {
              CLASSEMENT_LABELS[
                importable.find((c) => c.cleabs === hover.cleabs)
                  ?.suggestedClassement ?? RuralPathClassement.VOIE_COMMUNALE
              ]
            }
          </div>
        </Popup>
      )}
    </>
  );
}
