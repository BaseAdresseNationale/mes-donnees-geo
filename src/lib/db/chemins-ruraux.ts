import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import type {
  RuralPath,
  RuralPathStatus,
  RuralPathSurface,
} from "@/components/CheminsRuraux/types";

const SELECT = {
  id: true,
  codeInsee: true,
  statut: true,
  nom: true,
  path: true,
  surfaces: true,
  createdAt: true,
  updatedAt: true,
} as const;

type Row = {
  id: string;
  codeInsee: string;
  statut: RuralPathStatus;
  nom: string | null;
  path: unknown;
  surfaces: RuralPathSurface[];
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(row: Row): RuralPath {
  return {
    id: row.id,
    codeInsee: row.codeInsee,
    statut: row.statut,
    ...(row.nom != null ? { nom: row.nom } : {}),
    ...(row.path != null ? { path: row.path as GeoJSON.MultiLineString } : {}),
    surfaces: row.surfaces,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getRuralPaths(codeCommune: string): Promise<RuralPath[]> {
  const rows = await prisma.ruralPath.findMany({
    where: { codeInsee: codeCommune, deletedAt: null },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: SELECT,
  });
  return rows.map((r) => toDomain(r as unknown as Row));
}

export async function getRuralPathById(
  codeCommune: string,
  id: string,
): Promise<RuralPath | null> {
  const row = await prisma.ruralPath.findFirst({
    where: { id, codeInsee: codeCommune, deletedAt: null },
    select: SELECT,
  });
  return row ? toDomain(row as unknown as Row) : null;
}

export interface RuralPathWriteInput {
  nom: string | null;
  statut: RuralPathStatus;
  path: GeoJSON.MultiLineString | null;
  surfaces: RuralPathSurface[];
}

export async function createRuralPath(
  codeCommune: string,
  input: RuralPathWriteInput,
): Promise<RuralPath> {
  const row = await prisma.ruralPath.create({
    data: {
      codeInsee: codeCommune,
      nom: input.nom,
      statut: input.statut,
      path:
        input.path === null
          ? Prisma.JsonNull
          : (input.path as unknown as Prisma.InputJsonValue),
      surfaces: input.surfaces,
    },
    select: SELECT,
  });
  return toDomain(row as unknown as Row);
}

export async function updateRuralPath(
  codeCommune: string,
  id: string,
  input: RuralPathWriteInput,
): Promise<RuralPath | null> {
  const result = await prisma.ruralPath.updateMany({
    where: { id, codeInsee: codeCommune, deletedAt: null },
    data: {
      nom: input.nom,
      statut: input.statut,
      path:
        input.path === null
          ? Prisma.JsonNull
          : (input.path as unknown as Prisma.InputJsonValue),
      surfaces: input.surfaces,
    },
  });
  if (result.count === 0) return null;
  return getRuralPathById(codeCommune, id);
}

export async function softDeleteRuralPath(
  codeCommune: string,
  id: string,
): Promise<boolean> {
  const result = await prisma.ruralPath.updateMany({
    where: { id, codeInsee: codeCommune, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return result.count > 0;
}
