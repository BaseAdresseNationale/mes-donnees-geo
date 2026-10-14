import type {
  ExpressionSpecification,
  SymbolLayerSpecification,
} from "maplibre-gl";
import type { LayerProps } from "react-map-gl/maplibre";
import type { BalTab } from "@/components/adresses/bal-tab";

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
// Numéros rattachés à aucun toponyme (même gris que l'API)
const NO_TOPONYME_COLOR = "#c1c4d6";
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

// Couleur des numéros : celle de leur voie, ou de leur toponyme
const NUMERO_VOIE_COLOR: ExpressionSpecification = ["get", "color"];
const NUMERO_TOPONYME_COLOR: ExpressionSpecification = [
  "case",
  ["has", "idToponyme"],
  ["get", "colorToponyme"],
  NO_TOPONYME_COLOR,
];

const numeroPointLayer = (color: ExpressionSpecification) =>
  ({
    id: "bal-numero-point",
    source: BAL_TILES_SOURCE_ID,
    "source-layer": "numeros-points",
    type: "circle",
    minzoom: BAL_TILES_MIN_ZOOM,
    maxzoom: NUMEROS_LABEL_MIN,
    paint: {
      "circle-color": color,
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
  }) as LayerProps;

const numeroLabelLayer = (color: ExpressionSpecification) =>
  ({
    id: "bal-numero-label",
    source: BAL_TILES_SOURCE_ID,
    "source-layer": "numeros-points",
    type: "symbol",
    minzoom: NUMEROS_LABEL_MIN,
    paint: {
      "text-color": "#fff",
      "text-halo-color": color,
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
  }) as LayerProps;

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

// Couches visibles selon l'onglet de la BAL. Toutes les couches restent sur
// la carte (seule leur visibilité change) : leur ordre ne bouge pas et la
// source n'est pas rechargée quand on change d'onglet.
const VISIBLE_LAYER_IDS: Record<BalTab, string[]> = {
  commune: [
    "bal-voie-trace",
    "bal-numero-point",
    "bal-numero-label",
    "bal-voie-label",
    "bal-toponyme-label",
  ],
  voies: [
    "bal-voie-trace",
    "bal-numero-point",
    "bal-numero-label",
    "bal-voie-label",
  ],
  toponymes: ["bal-numero-point", "bal-numero-label", "bal-toponyme-label"],
};

function buildBalLayers(tab: BalTab): LayerProps[] {
  const numeroColor =
    tab === "toponymes" ? NUMERO_TOPONYME_COLOR : NUMERO_VOIE_COLOR;

  // Ordre de rendu : tracés, puis points, puis libellés au-dessus
  return [
    voieTraceLayer,
    numeroPointLayer(numeroColor),
    numeroLabelLayer(numeroColor),
    voieLabelLayer,
    toponymeLabelLayer,
  ].map(
    (layer) =>
      ({
        ...layer,
        layout: {
          ...(layer as { layout?: object }).layout,
          visibility: VISIBLE_LAYER_IDS[tab].includes(layer.id!)
            ? "visible"
            : "none",
        },
      }) as LayerProps,
  );
}

// Calculées une fois par onglet : objets stables d'un rendu à l'autre
const BAL_LAYERS_BY_TAB: Record<BalTab, LayerProps[]> = {
  commune: buildBalLayers("commune"),
  voies: buildBalLayers("voies"),
  toponymes: buildBalLayers("toponymes"),
};

export function getBalLayers(tab: BalTab): LayerProps[] {
  return BAL_LAYERS_BY_TAB[tab];
}

// Couches des numéros (ex. pour masquer le numéro en cours d'édition)
export const BAL_NUMERO_LAYER_IDS = ["bal-numero-point", "bal-numero-label"];

// Couche des tracés de voies (ex. pour masquer le tracé en cours d'édition)
export const BAL_VOIE_TRACE_LAYER_ID = "bal-voie-trace";

// Ids de toutes les couches (pour les événements de survol)
export const BAL_LAYER_IDS = VISIBLE_LAYER_IDS.commune;
