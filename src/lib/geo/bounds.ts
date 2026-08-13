import { Geometry } from "geojson";

export function geometryBounds(
  geom: Geometry,
): [[number, number], [number, number]] | null {
  const coords: [number, number][] = [];
  const push = (c: unknown) => {
    if (
      Array.isArray(c) &&
      typeof c[0] === "number" &&
      typeof c[1] === "number"
    ) {
      coords.push([c[0], c[1]]);
    } else if (Array.isArray(c)) {
      c.forEach(push);
    }
  };
  push(
    geom.type === "GeometryCollection"
      ? []
      : (geom as { coordinates: unknown }).coordinates,
  );
  if (coords.length === 0) return null;
  let [minX, minY] = coords[0];
  let [maxX, maxY] = coords[0];
  for (const [x, y] of coords) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}
