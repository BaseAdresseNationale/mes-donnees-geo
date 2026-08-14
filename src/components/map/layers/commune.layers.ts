export const COMMUNE_SOURCE = "commune-contour";
export const COMMUNE_MASK_SOURCE = "commune-mask";
const COMMUNE_OUTLINE = "commune-contour-outline";
const COMMUNE_MASK = "commune-contour-mask";

// Appliqué sur COMMUNE_MASK_SOURCE (le masque inversé), pas sur le contour lui-même.
export const communeMaskLayer = {
  id: COMMUNE_MASK,
  type: "fill",
  source: COMMUNE_MASK_SOURCE,
  paint: {
    "fill-color": "#000091",
    "fill-opacity": 0.04,
  },
};

export const communeOutlineLayer = {
  id: COMMUNE_OUTLINE,
  type: "line",
  source: COMMUNE_SOURCE,
  paint: {
    "line-color": "#000091",
    "line-width": 2,
    "line-dasharray": [3, 2],
  },
};
