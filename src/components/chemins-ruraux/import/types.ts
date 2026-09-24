import type {
  RuralPathSource,
  RuralPathSurface,
} from "@/generated/prisma/browser";

export interface ImportSegmentResponse {
  path: GeoJSON.LineString;
  source: RuralPathSource;
  surface: RuralPathSurface;
}

/** Chemin rural cadastral constitué (nom/numéro + N segments), prêt à importer. */
export interface AssembledRuralPathResponse {
  key: string;
  numero: number | null;
  nom: string | null;
  segments: ImportSegmentResponse[];
  longueur: number;
  alreadyImported: boolean;
}
