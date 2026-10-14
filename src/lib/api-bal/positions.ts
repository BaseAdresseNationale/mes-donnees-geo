import type { Position } from "./generated/types.gen";

export type PositionType = Position["type"];

// Types de position acceptés par mes-adresses-api (la valeur est le libellé
// en minuscules ; attention à l'apostrophe typographique de « cage d’escalier »)
export const POSITION_TYPES: { value: PositionType; label: string }[] = [
  { value: "entrée", label: "Entrée" },
  { value: "bâtiment", label: "Bâtiment" },
  { value: "cage d’escalier", label: "Cage d’escalier" },
  { value: "logement", label: "Logement" },
  { value: "service technique", label: "Service technique" },
  { value: "délivrance postale", label: "Délivrance postale" },
  { value: "parcelle", label: "Parcelle" },
  { value: "segment", label: "Segment" },
];

export const DEFAULT_POSITION_TYPE: PositionType = "entrée";

export function getPositionTypeLabel(type: string): string {
  return POSITION_TYPES.find((t) => t.value === type)?.label ?? type;
}
