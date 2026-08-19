export enum RuralPathStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  CERTIFIED = "certified",
}

export enum RuralPathSurface {
  EARTH = "terre",
  GRAVEL = "gravier",
  PAVED = "enrobe",
  STONED = "empierre",
  GRASS = "herbe",
}

export type RuralPath = {
  id: string;
  codeInsee: string;
  statut: RuralPathStatus;
  nom?: string;
  path?: GeoJSON.MultiLineString;
  // 1 revêtement par LineString du MultiLineString (même index)
  surfaces: RuralPathSurface[];
  createdAt: string;
  updatedAt: string;
};
