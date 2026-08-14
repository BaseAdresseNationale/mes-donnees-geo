export const PARCELLES_MINZOOM = 14;

export const staticCadastreLayers = [
  {
    id: "batiments-fill",
    type: "fill",
    source: "cadastre",
    "source-layer": "batiments",
    minzoom: PARCELLES_MINZOOM,
    paint: {
      "fill-opacity": 0.3,
    },
    layout: {
      visibility: "none",
    },
  },
  {
    id: "batiments-line",
    type: "line",
    source: "cadastre",
    "source-layer": "batiments",
    minzoom: PARCELLES_MINZOOM,
    maxzoom: 22,
    layout: {
      visibility: "none",
    },
    paint: {
      "line-opacity": 1,
      "line-color": "rgba(0, 0, 0, 1)",
    },
  },
  {
    id: "parcelles",
    type: "line",
    source: "cadastre",
    "source-layer": "parcelles",
    minzoom: PARCELLES_MINZOOM,
    maxzoom: 24,
    layout: {
      visibility: "none",
    },
    paint: {
      "line-color": "#0053b3",
      "line-opacity": 0.9,
      "line-width": {
        stops: [
          [16, 1],
          [17, 2],
        ],
      },
    },
  },
  {
    id: "sections",
    type: "line",
    source: "cadastre",
    "source-layer": "sections",
    minzoom: 12,
    maxzoom: 24,
    layout: {
      visibility: "none",
    },
    paint: {
      "line-color": "rgba(116, 134, 241, 1)",
      "line-opacity": 0.9,
      "line-width": 2,
    },
  },
  {
    id: "code-section",
    type: "symbol",
    source: "cadastre",

    "source-layer": "sections",
    minzoom: 12.5,
    maxzoom: 16,
    layout: {
      visibility: "none",
      "text-field": "{code}",
      "text-font": ["Open Sans Regular"],
    },
    paint: {
      "text-halo-color": "rgba(255, 246, 241, 1)",
      "text-halo-width": 1.5,
    },
  },
  {
    id: "code-parcelles",
    type: "symbol",
    source: "cadastre",
    "source-layer": "parcelles",
    minzoom: 16,
    filter: ["all"],
    layout: {
      visibility: "none",
      "text-field": [
        "concat",
        ["get", "section"],
        ["slice", ["concat", "000", ["to-string", ["get", "numero"]]], -4],
      ],
      "text-font": ["Open Sans Regular"],
      "text-allow-overlap": false,
      "text-size": 16,
    },
    paint: {
      "text-halo-color": "#fff6f1",
      "text-halo-width": 1.5,
      "text-translate-anchor": "map",
    },
  },
];

export const parcellesHighlightedLayer = {
  id: "parcelle-highlighted",
  type: "fill",
  source: "cadastre",
  "source-layer": "parcelles",
  filter: ["==", ["get", "id"], ""],
  minzoom: PARCELLES_MINZOOM,
  layout: {
    visibility: "none",
  },
  paint: {
    "fill-color": "#0053b3",
    "fill-opacity": 0.5,
  },
};

export const parcelleHoveredLayer = {
  id: "parcelle-hovered",
  type: "fill",
  source: "cadastre",
  "source-layer": "parcelles",
  minzoom: PARCELLES_MINZOOM,
  layout: {
    visibility: "none",
  },
  paint: {
    "fill-color": [
      "case",
      ["boolean", ["feature-state", "hover"], false],
      "#0053b3",
      "transparent",
    ],
    "fill-opacity": 0.6,
  },
};
