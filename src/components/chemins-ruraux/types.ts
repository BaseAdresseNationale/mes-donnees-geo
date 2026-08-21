export { RuralPathStatus, RuralPathSurface } from "@/generated/prisma/browser";
import type {
  RuralPathStatus,
  RuralPathSurface,
} from "@/generated/prisma/browser";

export type RuralPath = {
  id: string;
  codeInsee: string;
  statut: RuralPathStatus;
  nom?: string;
  path?: GeoJSON.MultiLineString;
  surfaces: RuralPathSurface[];
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

export const SURFACE_COLORS: Record<RuralPathSurface, string> = {
  EARTH: "#8a5a2b",
  GRAVEL: "#8d8d8d",
  PAVED: "#2b2b2b",
  STONED: "#c98a3f",
  GRASS: "#3f8a3f",
};
