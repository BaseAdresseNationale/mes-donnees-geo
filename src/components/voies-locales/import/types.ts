import type {
  LocalPathClassement,
  LocalPathRevetement,
  LocalPathSource,
  LocalPathType,
} from "@/generated/prisma/browser";

export interface ImportSegmentResponse {
  path: GeoJSON.LineString;
  source: LocalPathSource;
  sourceRef?: string | null;
  type: LocalPathType;
  revetement: LocalPathRevetement;
  largeurMoyenne: number | null;
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
  /** Part (0..1) du filaire cadastral couverte par le tracé BD TOPO. */
  couverture?: number | null;
}
