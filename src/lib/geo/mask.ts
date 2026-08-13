import type { Feature, MultiPolygon, Polygon, Position } from "geojson";

// Anneau couvrant l'ensemble du globe, utilisé comme contour extérieur du masque inversé.
const WORLD_RING: Position[] = [
  [-180, -90],
  [180, -90],
  [180, 90],
  [-180, 90],
  [-180, -90],
];

/**
 * Construit un polygone "monde moins la géométrie fournie" : les anneaux
 * extérieurs de `geometry` deviennent des trous dans un polygone couvrant le
 * globe. Permet d'assombrir tout ce qui est en dehors d'un contour (ex.
 * commune) plutôt que le contour lui-même.
 */
export function buildInvertedMask(
  geometry: Polygon | MultiPolygon,
): Feature<Polygon> {
  const holes =
    geometry.type === "Polygon"
      ? [geometry.coordinates[0]]
      : geometry.coordinates.map((polygon) => polygon[0]);

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [WORLD_RING, ...holes],
    },
  };
}
