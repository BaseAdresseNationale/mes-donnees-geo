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
