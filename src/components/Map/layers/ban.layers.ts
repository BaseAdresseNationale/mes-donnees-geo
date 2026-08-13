// DSFR default blue color
export const DEFAULT_COLOR_DARK = "#000091";
export const DEFAULT_COLOR_LIGHT = "#f0f0f0";

const NUMEROS_POINT_MIN = 12;
const NUMEROS_MIN = 17;

const TOPONYME_MIN = 15;
const TOPONYME_MAX = 24;

const VOIE_MIN = 15;
const VOIE_MAX = 24;

export const adresseCircleLayer = {
  id: "adresse",
  source: "base-adresse-nationale",
  "source-layer": "adresses",
  type: "circle",
  minzoom: NUMEROS_POINT_MIN,
  paint: {
    "circle-color": DEFAULT_COLOR_DARK,
    "circle-opacity": [
      "case",
      ["boolean", ["feature-state", "hover"], false],
      1,
      0.6,
    ],
    "circle-radius": {
      stops: [
        [12, 0.8],
        [17, 6],
      ],
    },
    "circle-stroke-width": 2,
    "circle-stroke-color": DEFAULT_COLOR_LIGHT,
  },
};

export const adresseLabelLayer = {
  id: "adresse-label",
  source: "base-adresse-nationale",
  "source-layer": "adresses",
  type: "symbol",
  minzoom: NUMEROS_MIN,
  paint: {
    "text-color": DEFAULT_COLOR_DARK,
    "text-halo-color": DEFAULT_COLOR_LIGHT,
    "text-halo-width": 2,
    "text-opacity": [
      "case",
      ["boolean", ["feature-state", "hover"], false],
      1,
      0.6,
    ],
  },
  layout: {
    "text-font": ["Noto Sans Bold"],
    "text-size": {
      stops: [
        [NUMEROS_MIN, 13],
        [19, 16],
      ],
    },
    "text-field": [
      "case",
      ["has", "suffixe"],
      ["format", ["get", "numero"], {}, " ", {}, ["get", "suffixe"], {}],
      ["get", "numero"],
    ],
    "text-ignore-placement": false,
    "text-variable-anchor": ["bottom"],
    "text-radial-offset": 1,
  },
};

export const voieLayer = {
  id: "voie",
  source: "base-adresse-nationale",
  "source-layer": "toponymes",
  type: "symbol",
  minzoom: VOIE_MIN,
  maxzoom: VOIE_MAX,
  paint: {
    "text-color": DEFAULT_COLOR_DARK,
    "text-opacity": [
      "case",
      ["boolean", ["feature-state", "hover"], false],
      1,
      0.8,
    ],
    "text-halo-color": DEFAULT_COLOR_LIGHT,
    "text-halo-width": 2,
    "text-translate-anchor": "map",
  },
  layout: {
    "text-font": ["Noto Sans Bold"],
    "text-size": ["step", ["get", "nbNumeros"], 8, 20, 10, 50, 14, 100, 16],
    "text-field": ["get", "nomVoie"],
  },
};

export const toponymeLayer = {
  id: "toponyme",
  source: "base-adresse-nationale",
  "source-layer": "toponymes",
  type: "symbol",
  minzoom: TOPONYME_MIN,
  maxzoom: TOPONYME_MAX,
  paint: {
    "text-color": DEFAULT_COLOR_DARK,
    "text-opacity": [
      "case",
      ["boolean", ["feature-state", "hover"], false],
      1,
      0.8,
    ],
    "text-halo-color": DEFAULT_COLOR_LIGHT,
    "text-halo-width": 2,
    "text-translate-anchor": "map",
  },
  layout: {
    "text-font": ["Noto Sans Bold"],
    "text-size": {
      stops: [
        [0, 3],
        [10, 15],
      ],
    },
    "text-field": ["get", "nomVoie"],
    "text-ignore-placement": false,
    "text-variable-anchor": ["bottom", "top", "right", "left"],
    "text-radial-offset": 0.1,
    "text-allow-overlap": false,
  },
};

const BANLayers = [
  { layer: adresseCircleLayer, interactive: true },
  { layer: adresseLabelLayer },
  { layer: voieLayer, interactive: true },
  { layer: toponymeLayer, interactive: true },
];

export default BANLayers;
