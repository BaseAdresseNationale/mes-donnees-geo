"use client";

import { useEffect, useState } from "react";
import type { FeatureCollection, LineString } from "geojson";
import { Layer, Source } from "react-map-gl/maplibre";
import {
  CADASTRAL_RURAL_PATHS_SOURCE_ID,
  cadastralRuralPathsCasingLayer,
  cadastralRuralPathsLabelLayer,
  cadastralRuralPathsLineLayer,
} from "./cadastral-rural-paths.layers";

interface CadastralRuralPathProperties {
  libelle: string;
}

const EMPTY_FEATURE_COLLECTION: FeatureCollection<
  LineString,
  CadastralRuralPathProperties
> = {
  type: "FeatureCollection",
  features: [],
};

export function CadastralRuralPathsMap() {
  const [data, setData] = useState(EMPTY_FEATURE_COLLECTION);

  useEffect(() => {
    const controller = new AbortController();

    async function loadRuralPaths() {
      try {
        const response = await fetch("/api/cadastre/chemins-ruraux", {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(
            `Requête chemins ruraux échouée (${response.status})`,
          );
        }
        setData(
          (await response.json()) as FeatureCollection<
            LineString,
            CadastralRuralPathProperties
          >,
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error);
        }
      }
    }

    void loadRuralPaths();
    return () => controller.abort();
  }, []);

  return (
    <Source id={CADASTRAL_RURAL_PATHS_SOURCE_ID} type="geojson" data={data}>
      <Layer {...cadastralRuralPathsCasingLayer} />
      <Layer {...cadastralRuralPathsLineLayer} />
      <Layer {...cadastralRuralPathsLabelLayer} />
    </Source>
  );
}
