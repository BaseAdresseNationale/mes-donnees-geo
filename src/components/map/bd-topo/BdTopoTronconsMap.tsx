"use client";

import { useEffect, useMemo, useState } from "react";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import { Layer, Source } from "react-map-gl/maplibre";
import {
  BD_TOPO_ENDPOINTS_SOURCE_ID,
  BD_TOPO_TRONCONS_SOURCE_ID,
  bdTopoEndpointsLayer,
  bdTopoTronconsLabelLayer,
  bdTopoTronconsLineLayer,
} from "./bd-topo-troncons.layers";

interface TronconProperties {
  cleabs: string;
  nature: string;
  nomVoie: string | null;
}

const EMPTY: FeatureCollection<LineString, TronconProperties> = {
  type: "FeatureCollection",
  features: [],
};

// Tronçons du flux WFS BD TOPO : l'entrée exacte des algorithmes de matching.
export function BdTopoTronconsMap() {
  const [data, setData] = useState(EMPTY);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch("/api/bd-topo/troncons", {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Requête tronçons BD TOPO échouée (${response.status})`);
        }
        setData(
          (await response.json()) as FeatureCollection<
            LineString,
            TronconProperties
          >,
        );
      } catch (error) {
        if (!controller.signal.aborted) console.error(error);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  const endpoints = useMemo<FeatureCollection<Point, TronconProperties>>(
    () => ({
      type: "FeatureCollection",
      features: data.features.flatMap((feature) => {
        const coordinates = feature.geometry.coordinates;
        return [coordinates[0], coordinates[coordinates.length - 1]].map(
          (position): Feature<Point, TronconProperties> => ({
            type: "Feature",
            properties: feature.properties,
            geometry: { type: "Point", coordinates: position },
          }),
        );
      }),
    }),
    [data],
  );

  return (
    <>
      <Source id={BD_TOPO_TRONCONS_SOURCE_ID} type="geojson" data={data}>
        <Layer {...bdTopoTronconsLineLayer} />
        <Layer {...bdTopoTronconsLabelLayer} />
      </Source>
      <Source id={BD_TOPO_ENDPOINTS_SOURCE_ID} type="geojson" data={endpoints}>
        <Layer {...bdTopoEndpointsLayer} />
      </Source>
    </>
  );
}
