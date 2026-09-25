export {
  LocalPathStatus,
  LocalPathRevetement,
  LocalPathType,
  LocalPathClassement,
  LocalPathEtat,
  LocalPathServitude,
  LocalPathBornage,
  LocalPathGestionnaire,
  LocalPathDeletionReason,
  LocalPathSource,
} from "@/generated/prisma/browser";
import type {
  LocalPathStatus,
  LocalPathRevetement,
  LocalPathType,
  LocalPathClassement,
  LocalPathEtat,
  LocalPathServitude,
  LocalPathBornage,
  LocalPathGestionnaire,
  LocalPathDeletionReason,
  LocalPathSource,
} from "@/generated/prisma/browser";

export type LocalPathSegment = {
  id: string;
  ordre: number;
  path: GeoJSON.LineString;
  type: LocalPathType;
  revetement: LocalPathRevetement;
  largeurMoyenne?: number;
  etat: LocalPathEtat;
  fermeALaCirculation?: boolean;
  servitudes: LocalPathServitude[];
  bornage?: LocalPathBornage;
  source: LocalPathSource;
  sourceRef?: string;
};

export type LocalPath = {
  id: string;
  codeInsee: string;
  statut: LocalPathStatus;
  nom?: string;
  classement: LocalPathClassement;
  numero: number;
  gestionnaire?: LocalPathGestionnaire;
  commentaire?: string;
  deletionReason?: LocalPathDeletionReason;
  segments: LocalPathSegment[];
  createdAt: string;
  updatedAt: string;
};

export const REVETEMENT_LABELS: Record<LocalPathRevetement, string> = {
  REVETU: "Revêtu",
  EMPIERRE: "Empierré",
  NON_REVETU: "Non revêtu",
};

export const TYPE_LABELS: Record<LocalPathType, string> = {
  CHEMIN: "Chemin",
  IMPASSE: "Impasse",
  TRONCON: "Tronçon",
  SENTIER: "Sentier",
  PLACE: "Place",
  RUE: "Rue",
};

export const CLASSEMENT_LABELS: Record<LocalPathClassement, string> = {
  CHEMIN_RURAL: "Chemin rural",
  VOIE_COMMUNALE: "Voie communale",
};

export const ETAT_LABELS: Record<LocalPathEtat, string> = {
  EN_PROJET: "En projet",
  EN_CONSTRUCTION: "En construction",
  BON: "Bon",
  MOYEN: "Moyen",
  MAUVAIS: "Mauvais",
  TRES_MAUVAIS: "Très mauvais",
};

export const SERVITUDE_LABELS: Record<LocalPathServitude, string> = {
  INTERET_COMMUNAUTAIRE: "Intérêt communautaire",
  PDIPR: "PDIPR",
  DFCI: "DFCI",
  DESSERTE_FORESTIERE: "Desserte forestière",
  HALAGE: "Halage",
  PASSAGE_LONGITUDINAL: "Passage longitudinal",
  AUTRE_SERVITUDE: "Autre servitude",
};

export const BORNAGE_LABELS: Record<LocalPathBornage, string> = {
  TOTAL: "Total",
  UNILATERAL: "Unilatéral",
  PARTIEL: "Partiel",
  NON_BORNE: "Non borné",
};

export const GESTIONNAIRE_LABELS: Record<LocalPathGestionnaire, string> = {
  COMMUNE: "Commune",
  DEPARTEMENT: "Département",
  REGION: "Région",
  ETAT: "État",
  EPCI: "EPCI",
  VNF: "VNF",
  PRIVE: "Privé",
  CONCESSIONNAIRE: "Concessionnaire",
  ONF: "ONF",
  GRAND_PORT_MARITIME: "Grand port maritime",
  PORT_AUTONOME: "Port autonome",
  SECTION_DE_COMMUNE: "Section de commune",
  COLLECTIVITE_STATUT_PARTICULIER: "Collectivité à statut particulier",
  COLLECTIVITE_TERRITORIALE_UNIQUE: "Collectivité territoriale unique",
  COLLECTIVITE_OUTRE_MER: "Collectivité d'outre-mer",
  COLLECTIVITE_SUI_GENERIS: "Collectivité sui generis",
};

export const DELETION_REASON_LABELS: Record<LocalPathDeletionReason, string> = {
  ANNEXE: "Annexé",
  ACCAPARE: "Accaparé",
  APPROPRIE: "Approprié",
  DISPARU: "Disparu",
  INEXISTANT: "Inexistant",
};

export const REVETEMENT_COLORS: Record<LocalPathRevetement, string> = {
  REVETU: "#2b2b2b",
  EMPIERRE: "#c98a3f",
  NON_REVETU: "#8a5a2b",
};

export const CLASSEMENT_COLORS: Record<LocalPathClassement, string> = {
  CHEMIN_RURAL: "#18753c",
  VOIE_COMMUNALE: "#0063cb",
};

export const SOURCE_LABELS: Record<LocalPathSource, string> = {
  MANUEL: "Saisie manuelle",
  BD_TOPO: "Import BD TOPO",
};
