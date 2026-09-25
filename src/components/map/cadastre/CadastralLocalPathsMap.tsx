"use client";

import { useEffect, useState } from "react";
import type { FeatureCollection, LineString } from "geojson";
import { Layer, Source } from "react-map-gl/maplibre";
import type { LocalPathClassement } from "@/components/voies-locales/types";
import {
  CADASTRAL_LOCAL_PATHS_SOURCE_ID,
  cadastralLocalPathsCasingLayer,
  cadastralLocalPathsLabelLayer,
  cadastralLocalPathsLineLayer,
} from "./cadastral-local-paths.layers";

interface CadastralLocalPathProperties {
  libelle: string;
  classement: LocalPathClassement;
}

const EMPTY_FEATURE_COLLECTION: FeatureCollection<
  LineString,
  CadastralLocalPathProperties
> = {
  type: "FeatureCollection",
  features: [],
};

export function CadastralLocalPathsMap() {
  const [data, setData] = useState(EMPTY_FEATURE_COLLECTION);

  useEffect(() => {
    const controller = new AbortController();

    async function loadLocalPaths() {
      try {
        const response = await fetch("/api/cadastre/voies-locales", {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Requête voies locales échouée (${response.status})`);
        }
        setData(
          (await response.json()) as FeatureCollection<
            LineString,
            CadastralLocalPathProperties
          >,
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error);
        }
      }
    }

    void loadLocalPaths();
    return () => controller.abort();
  }, []);

  return (
    <Source id={CADASTRAL_LOCAL_PATHS_SOURCE_ID} type="geojson" data={data}>
      <Layer {...cadastralLocalPathsCasingLayer} />
      <Layer {...cadastralLocalPathsLineLayer} />
      <Layer {...cadastralLocalPathsLabelLayer} />
    </Source>
  );
}
