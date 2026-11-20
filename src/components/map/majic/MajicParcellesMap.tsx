"use client";

import { useEffect, useState } from "react";
import type { FeatureCollection, Geometry } from "geojson";
import { Layer, Source } from "react-map-gl/maplibre";
import type { MajicParcelleProperties } from "@/lib/majic/client";
import {
  MAJIC_SOURCE_ID,
  majicFillLayer,
  majicLabelLayer,
  majicLineLayer,
} from "./majic.layers";

const EMPTY_FEATURE_COLLECTION: FeatureCollection<
  Geometry,
  MajicParcelleProperties
> = {
  type: "FeatureCollection",
  features: [],
};

export function MajicParcellesMap() {
  const [data, setData] = useState(EMPTY_FEATURE_COLLECTION);

  useEffect(() => {
    const controller = new AbortController();

    async function loadParcelles() {
      try {
        const response = await fetch("/api/majic/parcelles", {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(
            `Requête parcelles MAJIC échouée (${response.status})`,
          );
        }
        setData(
          (await response.json()) as FeatureCollection<
            Geometry,
            MajicParcelleProperties
          >,
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error);
        }
      }
    }

    void loadParcelles();
    return () => controller.abort();
  }, []);

  return (
    <Source id={MAJIC_SOURCE_ID} type="geojson" data={data}>
      <Layer {...majicFillLayer} />
      <Layer {...majicLineLayer} />
      <Layer {...majicLabelLayer} />
    </Source>
  );
}
