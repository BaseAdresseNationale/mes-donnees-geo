import type { LayerProps } from "react-map-gl/maplibre";

export const CADASTRAL_RURAL_PATHS_SOURCE_ID = "cadastral-rural-paths";

export const cadastralRuralPathsCasingLayer: LayerProps = {
  id: "cadastral-rural-paths-casing",
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

export const cadastralRuralPathsLineLayer: LayerProps = {
  id: "cadastral-rural-paths-line",
  type: "line",
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
  paint: {
    "line-color": "#18753c",
    "line-dasharray": [2, 1.5],
    "line-width": 3,
  },
};

export const cadastralRuralPathsLabelLayer: LayerProps = {
  id: "cadastral-rural-paths-label",
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
    "text-color": "#18753c",
    "text-halo-color": "#ffffff",
    "text-halo-width": 2,
  },
};
