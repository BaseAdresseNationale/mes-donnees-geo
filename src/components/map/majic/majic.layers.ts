import type { LayerProps } from "react-map-gl/maplibre";

export const MAJIC_SOURCE_ID = "majic-parcelles";

const MAJIC_COLOR = "#a558a0";

export const majicFillLayer: LayerProps = {
  id: "majic-parcelles-fill",
  type: "fill",
  minzoom: 12,
  paint: {
    "fill-color": MAJIC_COLOR,
    "fill-opacity": 0.35,
  },
};

export const majicLineLayer: LayerProps = {
  id: "majic-parcelles-line",
  type: "line",
  minzoom: 12,
  paint: {
    "line-color": MAJIC_COLOR,
    "line-width": 1.5,
  },
};

export const majicLabelLayer: LayerProps = {
  id: "majic-parcelles-label",
  type: "symbol",
  minzoom: 16,
  layout: {
    "text-field": ["get", "denomination"],
    "text-font": ["Open Sans Regular"],
    "text-size": 12,
    "text-max-width": 8,
  },
  paint: {
    "text-color": "#4b2147",
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.5,
  },
};
