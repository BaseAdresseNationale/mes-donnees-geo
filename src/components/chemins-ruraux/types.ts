export {
  RuralPathStatus,
  RuralPathSurface,
  RuralPathClassement,
  RuralPathEtat,
  RuralPathDomanialite,
} from "@/generated/prisma/browser";
import type {
  RuralPathStatus,
  RuralPathSurface,
  RuralPathClassement,
  RuralPathEtat,
  RuralPathDomanialite,
} from "@/generated/prisma/browser";

export type RuralPathSegment = {
  id: string;
  ordre: number;
  path: GeoJSON.LineString;
  surface: RuralPathSurface;
  largeurMoyenne?: number;
  etatEntretien?: RuralPathEtat;
  etatConservation?: RuralPathEtat;
  domanialite?: RuralPathDomanialite;
};

export type RuralPath = {
  id: string;
  codeInsee: string;
  statut: RuralPathStatus;
  nom?: string;
  classement: RuralPathClassement;
  numero: number;
  commentaire?: string;
  segments: RuralPathSegment[];
  createdAt: string;
  updatedAt: string;
};

export const SURFACE_LABELS: Record<RuralPathSurface, string> = {
  EARTH: "Terre",
  GRAVEL: "Gravier",
  PAVED: "Enrobé",
  STONED: "Empierré",
  GRASS: "Herbe",
};

export const CLASSEMENT_LABELS: Record<RuralPathClassement, string> = {
  CHEMIN_RURAL: "Chemin rural",
  VOIE_COMMUNALE: "Voie communale",
  CHEMIN_D_EXPLOITATION: "Chemin d'exploitation",
  VOIE_COMMUNAUTAIRE: "Voie communautaire",
};

export const ETAT_LABELS: Record<RuralPathEtat, string> = {
  EXCELLENT: "Excellent",
  BON: "Bon",
  MOYEN: "Moyen",
  MAUVAIS: "Mauvais",
};

export const DOMANIALITE_LABELS: Record<RuralPathDomanialite, string> = {
  INDETERMINE: "Indéterminée",
  PRIVE: "Privée",
  PRIVE_OUVERT_A_LA_CIRCULATION: "Privée ouverte à la circulation",
  PUBLIC: "Publique",
};

export const SURFACE_COLORS: Record<RuralPathSurface, string> = {
  EARTH: "#8a5a2b",
  GRAVEL: "#8d8d8d",
  PAVED: "#2b2b2b",
  STONED: "#c98a3f",
  GRASS: "#3f8a3f",
};
