import type {
  LocalPath,
  LocalPathClassement,
  LocalPathSegment,
} from "@/components/voies-locales/types";

export type PublishedSegment = Omit<LocalPathSegment, "id">;

/** Voie telle que publiée : sans identifiants de segments ni champs techniques. */
export type PublishedPath = Omit<
  LocalPath,
  "createdAt" | "updatedAt" | "statut" | "segments"
> & { segments: PublishedSegment[] };

export type PublicationChangeKind = "added" | "modified" | "deleted";

export interface FieldChange {
  label: string;
  before: string | null;
  after: string | null;
}

export interface PublicationChange {
  id: string;
  kind: PublicationChangeKind;
  numero: number;
  nom: string | null;
  classement: LocalPathClassement;
  fields: FieldChange[];
  /** Fourni uniquement pour les suppressions (la voie n'est plus dans la liste). */
  geometry?: GeoJSON.MultiLineString;
}

export interface PublicationOverview {
  changes: PublicationChange[];
  /** Voies ayant déjà été publiées au moins une fois. */
  publishedPathIds: string[];
}
