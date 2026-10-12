import type {
  ExpressionSpecification,
  SymbolLayerSpecification,
} from "maplibre-gl";
import type { LayerProps } from "react-map-gl/maplibre";

// Couches des tuiles vectorielles d'une BAL servies par mes-adresses-api
// (/v2/bases-locales/{balId}/tiles/{z}/{x}/{y}.pbf). Styles repris de
// l'éditeur mes-adresses : la couleur de chaque voie est calculée par l'API
// et portée par la propriété "color" des features.

export const BAL_TILES_SOURCE_ID = "bal-tiles";

// L'API ne produit des tuiles qu'entre ces niveaux de zoom (204 au-delà)
export const BAL_TILES_MIN_ZOOM = 13;
export const BAL_TILES_MAX_ZOOM = 19;

// Au-delà de ce zoom, les numéros passent de points à libellés
const NUMEROS_LABEL_MIN = 17;

const HALO_COLOR = "#f8f4f0";
const LABEL_COLOR = "#000";

const isHovered: ExpressionSpecification = [
  "boolean",
  ["feature-state", "hover"],
  false,
];

const haloWidth: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  12,
  1.5,
  18,
  2,
];

// Libellé noir, coloré à la couleur de l'entité au survol
const nameLabelPaint: SymbolLayerSpecification["paint"] = {
  "text-color": ["case", isHovered, ["get", "color"], LABEL_COLOR],
  "text-halo-color": HALO_COLOR,
  "text-halo-blur": 0.5,
  "text-halo-width": haloWidth,
};

export const voieTraceLayer = {
  id: "bal-voie-trace",
  source: BAL_TILES_SOURCE_ID,
  "source-layer": "voies-linestrings",
  type: "line",
  minzoom: BAL_TILES_MIN_ZOOM,
  paint: {
    "line-color": ["get", "color"],
    "line-width": 4,
    "line-opacity": ["case", isHovered, 1, 0.7],
  },
  layout: {
    "line-join": "round",
    "line-cap": "round",
  },
} as LayerProps;

export const numeroPointLayer = {
  id: "bal-numero-point",
  source: BAL_TILES_SOURCE_ID,
  "source-layer": "numeros-points",
  type: "circle",
  minzoom: BAL_TILES_MIN_ZOOM,
  maxzoom: NUMEROS_LABEL_MIN,
  paint: {
    "circle-color": ["get", "color"],
    "circle-opacity": ["case", isHovered, 1, 0.7],
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 0.8, 17, 6],
    "circle-stroke-color": HALO_COLOR,
    "circle-stroke-width": [
      "interpolate",
      ["linear"],
      ["zoom"],
      12,
      0.3,
      17,
      0.8,
    ],
  },
} as LayerProps;

export const numeroLabelLayer = {
  id: "bal-numero-label",
  source: BAL_TILES_SOURCE_ID,
  "source-layer": "numeros-points",
  type: "symbol",
  minzoom: NUMEROS_LABEL_MIN,
  paint: {
    "text-color": "#fff",
    "text-halo-color": ["get", "color"],
    "text-halo-width": haloWidth,
    "text-opacity": ["case", isHovered, 1, 0.8],
  },
  layout: {
    "text-font": ["Noto Sans Bold"],
    "text-size": 13,
    "text-field": [
      "case",
      ["has", "suffixe"],
      ["format", ["get", "numero"], {}, " ", {}, ["get", "suffixe"], {}],
      ["get", "numero"],
    ],
    "text-allow-overlap": true,
    "text-variable-anchor": ["left", "right"],
    "text-radial-offset": 0.5,
  },
} as LayerProps;

export const voieLabelLayer = {
  id: "bal-voie-label",
  source: BAL_TILES_SOURCE_ID,
  "source-layer": "voies-points",
  type: "symbol",
  minzoom: BAL_TILES_MIN_ZOOM,
  paint: nameLabelPaint,
  layout: {
    "text-font": ["Noto Sans Regular"],
    "text-field": ["get", "nom"],
    "text-anchor": "top",
    "text-size": ["interpolate", ["linear"], ["zoom"], 13, 13, 15, 14],
  },
} as LayerProps;

export const toponymeLabelLayer = {
  id: "bal-toponyme-label",
  source: BAL_TILES_SOURCE_ID,
  "source-layer": "toponymes-points",
  type: "symbol",
  minzoom: BAL_TILES_MIN_ZOOM,
  paint: nameLabelPaint,
  layout: {
    "text-font": ["Noto Sans Bold"],
    "text-field": ["get", "nom"],
    "text-anchor": "top",
    "text-size": 15,
  },
} as LayerProps;

// Ordre de rendu : tracés, puis points, puis libellés au-dessus
export const BALLayers: LayerProps[] = [
  voieTraceLayer,
  numeroPointLayer,
  numeroLabelLayer,
  voieLabelLayer,
  toponymeLabelLayer,
];
