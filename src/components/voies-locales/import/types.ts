import type {
  LocalPathClassement,
  LocalPathRevetement,
  LocalPathSource,
} from "@/generated/prisma/browser";

export interface ImportSegmentResponse {
  path: GeoJSON.LineString;
  source: LocalPathSource;
  revetement: LocalPathRevetement;
}

/** Voie locale cadastrale constituée (nom/numéro + N segments), prête à importer. */
export interface AssembledLocalPathResponse {
  key: string;
  numero: number | null;
  nom: string | null;
  classement: LocalPathClassement;
  segments: ImportSegmentResponse[];
  longueur: number;
  alreadyImported: boolean;
}
