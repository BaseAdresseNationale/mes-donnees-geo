import type { Map as MapLibreMap } from "maplibre-gl";
import type { Position } from "geojson";

export const BD_TOPO_SNAP_SOURCE_ID = "voies-locales-bd-topo-snap";
export const BD_TOPO_SNAP_LAYER_ID = "voies-locales-bd-topo-snap-line";
export const BD_TOPO_SNAP_SOURCE_LAYER = "troncon_de_route";
export const BD_TOPO_TILES_URL =
  "https://data.geopf.fr/tms/1.0.0/BDTOPO/{z}/{x}/{y}.pbf";
// Les tuiles IGN ne contiennent `troncon_de_route` qu'à partir du zoom 15.
export const BD_TOPO_SNAP_MIN_ZOOM = 15;
export const BD_TOPO_SNAP_MAX_ZOOM = 19;
export const BD_TOPO_SNAP_METERS = 5;

// Mêmes constantes de conversion que `metersBetween` (useLocalPathDrawer).
const METERS_PER_DEGREE_LAT = 110540;
const METERS_PER_DEGREE_LNG_AT_EQUATOR = 111320;

export interface BdTopoSnap {
  coordinate: Position;
  cleabs: string;
}

// Point d'une ligne le plus proche de l'origine, en repère métrique local.
function nearestOnLine(
  line: Position[],
  lng: number,
  lat: number,
  kx: number,
): { distance: number; lng: number; lat: number } | null {
  let best: { distance: number; lng: number; lat: number } | null = null;
  for (let i = 0; i < line.length - 1; i++) {
    const ax = (line[i][0] - lng) * kx;
    const ay = (line[i][1] - lat) * METERS_PER_DEGREE_LAT;
    const bx = (line[i + 1][0] - lng) * kx;
    const by = (line[i + 1][1] - lat) * METERS_PER_DEGREE_LAT;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const t =
      lengthSq === 0
        ? 0
        : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSq));
    const px = ax + t * dx;
    const py = ay + t * dy;
    const distance = Math.hypot(px, py);
    if (!best || distance < best.distance) {
      best = {
        distance,
        lng: lng + px / kx,
        lat: lat + py / METERS_PER_DEGREE_LAT,
      };
    }
  }
  return best;
}

// Cherche le tronçon BD TOPO le plus proche (≤ 5 m) du curseur parmi les
// tuiles vectorielles déjà chargées, et renvoie le point projeté dessus.
export function snapToBdTopo(
  map: MapLibreMap,
  pixel: { x: number; y: number },
  lngLat: { lng: number; lat: number },
): BdTopoSnap | null {
  if (!map.getLayer(BD_TOPO_SNAP_LAYER_ID)) return null;
  const { lng, lat } = lngLat;

  const origin = map.project([lng, lat]);
  const north = map.project([
    lng,
    lat + BD_TOPO_SNAP_METERS / METERS_PER_DEGREE_LAT,
  ]);
  const radius = Math.hypot(north.x - origin.x, north.y - origin.y) + 2;

  const features = map.queryRenderedFeatures(
    [
      [pixel.x - radius, pixel.y - radius],
      [pixel.x + radius, pixel.y + radius],
    ],
    { layers: [BD_TOPO_SNAP_LAYER_ID] },
  );

  const kx = METERS_PER_DEGREE_LNG_AT_EQUATOR * Math.cos((lat * Math.PI) / 180);
  let best: BdTopoSnap | null = null;
  let bestDistance = BD_TOPO_SNAP_METERS;
  for (const feature of features) {
    const cleabs = feature.properties?.cleabs;
    if (typeof cleabs !== "string") continue;
    const geometry = feature.geometry;
    const lines =
      geometry.type === "LineString"
        ? [geometry.coordinates]
        : geometry.type === "MultiLineString"
          ? geometry.coordinates
          : [];
    for (const line of lines) {
      const hit = nearestOnLine(line, lng, lat, kx);
      if (hit && hit.distance <= bestDistance) {
        bestDistance = hit.distance;
        best = { coordinate: [hit.lng, hit.lat], cleabs };
      }
    }
  }
  return best;
}

// Marge : la géométrie des tuiles varie légèrement selon le zoom.
const VERIFY_TOLERANCE_METERS = BD_TOPO_SNAP_METERS + 1;

/**
 * Ne garde que les cleabs dont le tronçon passe encore à proximité d'au moins un
 * sommet du segment, d'après les tuiles chargées. Sans données fiables (zoom
 * trop faible, segment hors de la vue, tronçon non chargé), tout est conservé.
 */
export function keepSnappedCleabs(
  map: MapLibreMap,
  coordinates: Position[],
  sourceRef: string,
): string | null {
  if (!map.getLayer(BD_TOPO_SNAP_LAYER_ID)) return sourceRef;
  if (map.getZoom() < BD_TOPO_SNAP_MIN_ZOOM) return sourceRef;
  const bounds = map.getBounds();
  if (!coordinates.every((c) => bounds.contains([c[0], c[1]]))) {
    return sourceRef;
  }

  const kept = sourceRef.split(",").filter((cleabs) => {
    const features = map.querySourceFeatures(BD_TOPO_SNAP_SOURCE_ID, {
      sourceLayer: BD_TOPO_SNAP_SOURCE_LAYER,
      filter: ["==", ["get", "cleabs"], cleabs],
    });
    if (features.length === 0) return true;
    const lines = features.flatMap((feature) =>
      feature.geometry.type === "LineString"
        ? [feature.geometry.coordinates]
        : feature.geometry.type === "MultiLineString"
          ? feature.geometry.coordinates
          : [],
    );
    return coordinates.some((c) => {
      const kx =
        METERS_PER_DEGREE_LNG_AT_EQUATOR * Math.cos((c[1] * Math.PI) / 180);
      return lines.some(
        (line) =>
          (nearestOnLine(line, c[0], c[1], kx)?.distance ?? Infinity) <=
          VERIFY_TOLERANCE_METERS,
      );
    });
  });
  return kept.length > 0 ? kept.join(",") : null;
}
