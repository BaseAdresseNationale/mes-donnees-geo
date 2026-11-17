import type { ExpressionSpecification } from "maplibre-gl";
import type { LayerProps } from "react-map-gl/maplibre";

export const BD_TOPO_TRONCONS_SOURCE_ID = "bd-topo-troncons";
export const BD_TOPO_ENDPOINTS_SOURCE_ID = "bd-topo-troncons-endpoints";

// Couleur par nature BD TOPO : les chemins/sentiers ressortent des routes.
const NATURE_COLOR_MATCH: ExpressionSpecification = [
  "match",
  ["get", "nature"],
  ["Chemin", "Sentier"],
  "#92400e",
  "Route empierrée",
  "#ca8a04",
  "#7c3aed",
] as unknown as ExpressionSpecification;

export const bdTopoTronconsLineLayer: LayerProps = {
  id: "bd-topo-troncons-line",
  type: "line",
  layout: { "line-cap": "round", "line-join": "round" },
  paint: {
    "line-color": NATURE_COLOR_MATCH,
    "line-width": 2,
    "line-opacity": 0.85,
  },
};

export const bdTopoTronconsLabelLayer: LayerProps = {
  id: "bd-topo-troncons-label",
  type: "symbol",
  minzoom: 15,
  layout: {
    "symbol-placement": "line",
    "symbol-spacing": 250,
    "text-field": [
      "coalesce",
      ["get", "nomVoie"],
      ["get", "nature"],
    ] as unknown as ExpressionSpecification,
    "text-font": ["Noto Sans Bold"],
    "text-size": 11,
  },
  paint: {
    "text-color": NATURE_COLOR_MATCH,
    "text-halo-color": "#ffffff",
    "text-halo-width": 2,
  },
};

// Extrémités des tronçons : montre où le graphe BD TOPO est connecté ou coupé.
export const bdTopoEndpointsLayer: LayerProps = {
  id: "bd-topo-troncons-endpoints",
  type: "circle",
  minzoom: 15,
  paint: {
    "circle-radius": 3,
    "circle-color": "#ffffff",
    "circle-stroke-color": "#111827",
    "circle-stroke-width": 1,
  },
};
