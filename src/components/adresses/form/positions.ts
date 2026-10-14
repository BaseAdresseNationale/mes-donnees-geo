import type { Position } from "@/lib/api-bal/generated/types.gen";
import { geometryBounds } from "@/lib/geo/bounds";

// Centre [lon, lat] de l'emprise d'une géométrie (ex. contour de la commune,
// pour placer le premier point d'une création)
export function boundsCenter(
  geometry: Parameters<typeof geometryBounds>[0] | undefined,
): [number, number] | null {
  const bounds = geometry ? geometryBounds(geometry) : null;
  if (!bounds) return null;
  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

// Position éditée dans un formulaire (numéro, toponyme)
export interface FormPosition {
  // Clé stable côté formulaire (indépendante du rang)
  key: number;
  type: string;
  longitude: number;
  latitude: number;
  // Source d'origine de la position, conservée à l'enregistrement
  source?: string;
}

export function toFormPositions(positions: Position[]): FormPosition[] {
  return positions.flatMap((position, index) => {
    const coordinates = (position.point as { coordinates?: unknown })
      .coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) return [];
    const [longitude, latitude] = coordinates as number[];
    return [
      {
        key: index,
        type: position.type,
        longitude,
        latitude,
        source: position.source || undefined,
      },
    ];
  });
}

// Positions envoyées à l'API : l'ordre définit leur rang ; id et rang sont
// générés par l'API, d'où le cast vers le type Position du SDK.
export function toApiPositions(positions: FormPosition[]): Position[] {
  return positions.map((position) => ({
    type: position.type,
    ...(position.source ? { source: position.source } : {}),
    point: {
      type: "Point",
      coordinates: [position.longitude, position.latitude],
    },
  })) as unknown as Position[];
}
