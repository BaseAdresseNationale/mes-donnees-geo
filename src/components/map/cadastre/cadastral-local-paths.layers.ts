import type { LayerProps } from "react-map-gl/maplibre";
import type { ExpressionSpecification } from "maplibre-gl";
import { CLASSEMENT_COLORS } from "@/components/voies-locales/types";

export const CADASTRAL_LOCAL_PATHS_SOURCE_ID = "cadastral-local-paths";

const CLASSEMENT_COLOR_MATCH: ExpressionSpecification = [
  "match",
  ["get", "classement"],
  ...Object.entries(CLASSEMENT_COLORS).flatMap(([classement, color]) => [
    classement,
    color,
  ]),
  CLASSEMENT_COLORS.CHEMIN_RURAL,
] as unknown as ExpressionSpecification;

export const cadastralLocalPathsCasingLayer: LayerProps = {
  id: "cadastral-local-paths-casing",
  type: "line",
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
  paint: {
    "line-color": "#ffffff",
    "line-opacity": 0.9,
    "line-width": 6,
  },
};

export const cadastralLocalPathsLineLayer: LayerProps = {
  id: "cadastral-local-paths-line",
  type: "line",
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
  paint: {
    "line-color": CLASSEMENT_COLOR_MATCH,
    "line-dasharray": [2, 1.5],
    "line-width": 3,
  },
};

export const cadastralLocalPathsLabelLayer: LayerProps = {
  id: "cadastral-local-paths-label",
  type: "symbol",
  minzoom: 14,
  layout: {
    "symbol-placement": "line",
    "symbol-spacing": 350,
    "text-field": ["get", "libelle"],
    "text-font": ["Noto Sans Bold"],
    "text-size": 12,
  },
  paint: {
    "text-color": CLASSEMENT_COLOR_MATCH,
    "text-halo-color": "#ffffff",
    "text-halo-width": 2,
  },
};
