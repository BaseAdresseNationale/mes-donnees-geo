import type { Position } from "geojson";

/**
 * Point situé à mi-longueur d'une ligne. Distances calculées sur un plan
 * local (longitude pondérée par cos(latitude)) : suffisant à l'échelle d'un segment.
 */
export function lineMidpoint(coordinates: Position[]): Position | null {
  if (coordinates.length === 0) return null;
  if (coordinates.length === 1) return coordinates[0];

  const lengths = coordinates.slice(1).map(([lng, lat], i) => {
    const [prevLng, prevLat] = coordinates[i];
    const cos = Math.cos((((lat + prevLat) / 2) * Math.PI) / 180);
    return Math.hypot((lng - prevLng) * cos, lat - prevLat);
  });
  const half = lengths.reduce((sum, l) => sum + l, 0) / 2;

  let travelled = 0;
  for (let i = 0; i < lengths.length; i++) {
    if (travelled + lengths[i] >= half && lengths[i] > 0) {
      const ratio = (half - travelled) / lengths[i];
      const [lng1, lat1] = coordinates[i];
      const [lng2, lat2] = coordinates[i + 1];
      return [lng1 + (lng2 - lng1) * ratio, lat1 + (lat2 - lat1) * ratio];
    }
    travelled += lengths[i];
  }
  return coordinates[0];
}
