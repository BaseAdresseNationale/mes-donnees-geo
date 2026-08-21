import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import type {
  RuralPath,
  RuralPathClassement,
  RuralPathDomanialite,
  RuralPathEtat,
  RuralPathSegment,
  RuralPathStatus,
  RuralPathSurface,
} from "@/components/chemins-ruraux/types";

const SELECT = {
  id: true,
  codeInsee: true,
  statut: true,
  nom: true,
  classement: true,
  numero: true,
  commentaire: true,
  createdAt: true,
  updatedAt: true,
  segments: {
    where: { deletedAt: null },
    orderBy: { ordre: "asc" },
    select: {
      id: true,
      ordre: true,
      path: true,
      surface: true,
      largeurMoyenne: true,
      etatEntretien: true,
      etatConservation: true,
      domanialite: true,
    },
  },
} as const;

type SegmentRow = {
  id: string;
  ordre: number;
  path: unknown;
  surface: RuralPathSurface;
  largeurMoyenne: number | null;
  etatEntretien: RuralPathEtat | null;
  etatConservation: RuralPathEtat | null;
  domanialite: RuralPathDomanialite | null;
};

type Row = {
  id: string;
  codeInsee: string;
  statut: RuralPathStatus;
  nom: string | null;
  classement: RuralPathClassement;
  numero: number;
  commentaire: string | null;
  segments: SegmentRow[];
  createdAt: Date;
  updatedAt: Date;
};

function toDomainSegment(row: SegmentRow): RuralPathSegment {
  return {
    id: row.id,
    ordre: row.ordre,
    path: row.path as GeoJSON.LineString,
    surface: row.surface,
    ...(row.largeurMoyenne != null
      ? { largeurMoyenne: row.largeurMoyenne }
      : {}),
    ...(row.etatEntretien != null ? { etatEntretien: row.etatEntretien } : {}),
    ...(row.etatConservation != null
      ? { etatConservation: row.etatConservation }
      : {}),
    ...(row.domanialite != null ? { domanialite: row.domanialite } : {}),
  };
}

function toDomain(row: Row): RuralPath {
  return {
    id: row.id,
    codeInsee: row.codeInsee,
    statut: row.statut,
    ...(row.nom != null ? { nom: row.nom } : {}),
    classement: row.classement,
    numero: row.numero,
    ...(row.commentaire != null ? { commentaire: row.commentaire } : {}),
    segments: row.segments.map(toDomainSegment),
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

export interface RuralPathSegmentWriteInput {
  path: GeoJSON.LineString;
  surface: RuralPathSurface;
  largeurMoyenne: number | null;
  etatEntretien: RuralPathEtat | null;
  etatConservation: RuralPathEtat | null;
  domanialite: RuralPathDomanialite | null;
}

export interface RuralPathWriteInput {
  nom: string | null;
  statut: RuralPathStatus;
  classement: RuralPathClassement;
  numero: number;
  commentaire: string | null;
  segments: RuralPathSegmentWriteInput[];
}

function segmentsCreateData(segments: RuralPathSegmentWriteInput[]) {
  return segments.map((seg, i) => ({
    ordre: i,
    path: seg.path as unknown as Prisma.InputJsonValue,
    surface: seg.surface,
    largeurMoyenne: seg.largeurMoyenne,
    etatEntretien: seg.etatEntretien,
    etatConservation: seg.etatConservation,
    domanialite: seg.domanialite,
  }));
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
      classement: input.classement,
      numero: input.numero,
      commentaire: input.commentaire,
      segments: { create: segmentsCreateData(input.segments) },
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
  return prisma.$transaction(async (tx) => {
    const ownership = await tx.ruralPath.updateMany({
      where: { id, codeInsee: codeCommune, deletedAt: null },
      data: {
        nom: input.nom,
        statut: input.statut,
        classement: input.classement,
        numero: input.numero,
        commentaire: input.commentaire,
      },
    });
    if (ownership.count === 0) return null;

    // Le formulaire renvoie l'intégralité des segments à chaque sauvegarde :
    // on remplace entièrement la collection plutôt que de diffé les segments.
    await tx.ruralPathSegment.deleteMany({ where: { ruralPathId: id } });
    if (input.segments.length > 0) {
      await tx.ruralPathSegment.createMany({
        data: segmentsCreateData(input.segments).map((seg) => ({
          ...seg,
          ruralPathId: id,
        })),
      });
    }

    const row = await tx.ruralPath.findUnique({
      where: { id },
      select: SELECT,
    });
    return row ? toDomain(row as unknown as Row) : null;
  });
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
