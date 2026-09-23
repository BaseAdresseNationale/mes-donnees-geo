import type {
  RuralPathClassement,
  RuralPathDomanialite,
  RuralPathSurface,
} from "@/generated/prisma/browser";

export interface BdTopoCandidateResponse {
  cleabs: string;
  nature: string;
  nomVoie: string | null;
  longueur: number;
  path: GeoJSON.LineString;
  suggestedClassement: RuralPathClassement;
  /** Numéro cadastral du chemin rural correspondant (géométrie coïncidente), si trouvé. */
  suggestedNumero: number | null;
  suggestedSurface: RuralPathSurface;
  suggestedLargeurMoyenne: number | null;
  suggestedDomanialite: RuralPathDomanialite | null;
  alreadyImported: boolean;
}
