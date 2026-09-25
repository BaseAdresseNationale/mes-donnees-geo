import "server-only";
import {
  Prisma,
  LocalPathSource as LocalPathSourceEnum,
  LocalPathStatus as LocalPathStatusEnum,
} from "@/generated/prisma/client";
import { prisma } from "./prisma";
import type {
  LocalPath,
  LocalPathBornage,
  LocalPathClassement,
  LocalPathDeletionReason,
  LocalPathEtat,
  LocalPathGestionnaire,
  LocalPathRevetement,
  LocalPathSegment,
  LocalPathServitude,
  LocalPathSource,
  LocalPathStatus,
  LocalPathType,
} from "@/components/voies-locales/types";

const SELECT = {
  id: true,
  codeInsee: true,
  statut: true,
  nom: true,
  classement: true,
  numero: true,
  gestionnaire: true,
  commentaire: true,
  deletionReason: true,
  createdAt: true,
  updatedAt: true,
  segments: {
    where: { deletedAt: null },
    orderBy: { ordre: "asc" },
    select: {
      id: true,
      ordre: true,
      path: true,
      type: true,
      revetement: true,
      largeurMoyenne: true,
      etat: true,
      fermeALaCirculation: true,
      servitudes: true,
      bornage: true,
      source: true,
      sourceRef: true,
    },
  },
} as const;

type SegmentRow = {
  id: string;
  ordre: number;
  path: unknown;
  type: LocalPathType;
  revetement: LocalPathRevetement;
  largeurMoyenne: number | null;
  etat: LocalPathEtat;
  fermeALaCirculation: boolean | null;
  servitudes: LocalPathServitude[];
  bornage: LocalPathBornage | null;
  source: LocalPathSource;
  sourceRef: string | null;
};

type Row = {
  id: string;
  codeInsee: string;
  statut: LocalPathStatus;
  nom: string | null;
  classement: LocalPathClassement;
  numero: number;
  gestionnaire: LocalPathGestionnaire | null;
  commentaire: string | null;
  deletionReason: LocalPathDeletionReason | null;
  segments: SegmentRow[];
  createdAt: Date;
  updatedAt: Date;
};

function toDomainSegment(row: SegmentRow): LocalPathSegment {
  return {
    id: row.id,
    ordre: row.ordre,
    path: row.path as GeoJSON.LineString,
    type: row.type,
    revetement: row.revetement,
    etat: row.etat,
    servitudes: row.servitudes,
    source: row.source,
    ...(row.largeurMoyenne != null
      ? { largeurMoyenne: row.largeurMoyenne }
      : {}),
    ...(row.fermeALaCirculation != null
      ? { fermeALaCirculation: row.fermeALaCirculation }
      : {}),
    ...(row.bornage != null ? { bornage: row.bornage } : {}),
    ...(row.sourceRef != null ? { sourceRef: row.sourceRef } : {}),
  };
}

function toDomain(row: Row): LocalPath {
  return {
    id: row.id,
    codeInsee: row.codeInsee,
    statut: row.statut,
    ...(row.nom != null ? { nom: row.nom } : {}),
    classement: row.classement,
    numero: row.numero,
    ...(row.gestionnaire != null ? { gestionnaire: row.gestionnaire } : {}),
    ...(row.commentaire != null ? { commentaire: row.commentaire } : {}),
    ...(row.deletionReason != null
      ? { deletionReason: row.deletionReason }
      : {}),
    segments: row.segments.map(toDomainSegment),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getLocalPaths(codeCommune: string): Promise<LocalPath[]> {
  const rows = await prisma.localPath.findMany({
    where: { codeInsee: codeCommune, deletedAt: null },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: SELECT,
  });
  return rows.map((r) => toDomain(r as unknown as Row));
}

export async function getLocalPathById(
  codeCommune: string,
  id: string,
): Promise<LocalPath | null> {
  const row = await prisma.localPath.findFirst({
    where: { id, codeInsee: codeCommune, deletedAt: null },
    select: SELECT,
  });
  return row ? toDomain(row as unknown as Row) : null;
}

export interface LocalPathSegmentWriteInput {
  path: GeoJSON.LineString;
  type: LocalPathType;
  revetement: LocalPathRevetement;
  largeurMoyenne: number | null;
  etat: LocalPathEtat;
  fermeALaCirculation: boolean | null;
  servitudes: LocalPathServitude[];
  bornage: LocalPathBornage | null;
  source?: LocalPathSource;
  sourceRef?: string | null;
}

export interface LocalPathWriteInput {
  nom: string | null;
  statut: LocalPathStatus;
  classement: LocalPathClassement;
  numero: number;
  gestionnaire: LocalPathGestionnaire | null;
  commentaire: string | null;
  segments: LocalPathSegmentWriteInput[];
}

function segmentsCreateData(segments: LocalPathSegmentWriteInput[]) {
  return segments.map((seg, i) => ({
    ordre: i,
    path: seg.path as unknown as Prisma.InputJsonValue,
    type: seg.type,
    revetement: seg.revetement,
    largeurMoyenne: seg.largeurMoyenne,
    etat: seg.etat,
    fermeALaCirculation: seg.fermeALaCirculation,
    servitudes: seg.servitudes,
    bornage: seg.bornage,
    source: seg.source ?? LocalPathSourceEnum.MANUEL,
    sourceRef: seg.sourceRef ?? null,
  }));
}

export async function createLocalPath(
  codeCommune: string,
  input: LocalPathWriteInput,
): Promise<LocalPath> {
  const row = await prisma.localPath.create({
    data: {
      codeInsee: codeCommune,
      nom: input.nom,
      statut: input.statut,
      classement: input.classement,
      numero: input.numero,
      gestionnaire: input.gestionnaire,
      commentaire: input.commentaire,
      segments: { create: segmentsCreateData(input.segments) },
    },
    select: SELECT,
  });
  return toDomain(row as unknown as Row);
}

export async function updateLocalPath(
  codeCommune: string,
  id: string,
  input: LocalPathWriteInput,
): Promise<LocalPath | null> {
  return prisma.$transaction(async (tx) => {
    const ownership = await tx.localPath.updateMany({
      where: { id, codeInsee: codeCommune, deletedAt: null },
      data: {
        nom: input.nom,
        statut: input.statut,
        classement: input.classement,
        numero: input.numero,
        gestionnaire: input.gestionnaire,
        commentaire: input.commentaire,
      },
    });
    if (ownership.count === 0) return null;

    // Le formulaire renvoie l'intégralité des segments à chaque sauvegarde :
    // on remplace entièrement la collection plutôt que de diffé les segments.
    await tx.localPathSegment.deleteMany({ where: { localPathId: id } });
    if (input.segments.length > 0) {
      await tx.localPathSegment.createMany({
        data: segmentsCreateData(input.segments).map((seg) => ({
          ...seg,
          localPathId: id,
        })),
      });
    }

    const row = await tx.localPath.findUnique({
      where: { id },
      select: SELECT,
    });
    return row ? toDomain(row as unknown as Row) : null;
  });
}

export async function softDeleteLocalPath(
  codeCommune: string,
  id: string,
  deletionReason: LocalPathDeletionReason | null = null,
): Promise<boolean> {
  const result = await prisma.localPath.updateMany({
    where: { id, codeInsee: codeCommune, deletedAt: null },
    data: { deletedAt: new Date(), deletionReason },
  });
  return result.count > 0;
}

/** Références externes (ex. cleabs BD TOPO) déjà importées et non supprimées pour cette commune/source. */
export async function getImportedSourceRefs(
  codeCommune: string,
  source: LocalPathSource,
): Promise<Set<string>> {
  const rows = await prisma.localPathSegment.findMany({
    where: {
      source,
      deletedAt: null,
      localPath: { codeInsee: codeCommune, deletedAt: null },
    },
    select: { sourceRef: true },
  });
  return new Set(
    rows.map((r) => r.sourceRef).filter((ref): ref is string => ref != null),
  );
}

export interface LocalPathImportSegmentInput extends LocalPathSegmentWriteInput {
  source: LocalPathSource;
  sourceRef: string | null;
}

export interface LocalPathImportInput {
  nom: string | null;
  classement: LocalPathClassement;
  /** Numéro cadastral du chemin rural correspondant, sinon attribution séquentielle. */
  numero?: number | null;
  segments: LocalPathImportSegmentInput[];
}

/**
 * Crée un lot de chemins brouillon à partir d'une source externe. Chaque chemin porte
 * N segments (portions de tronçons découpées + éventuels comblements), chaque segment
 * conservant sa propre `source`/`sourceRef`. `numero` est repris de `input.numero`
 * (ex. numéro cadastral) s'il est fourni, sinon attribué séquentiellement à partir du
 * plus grand numéro existant de la commune.
 */
export async function createLocalPathsFromImport(
  codeCommune: string,
  inputs: LocalPathImportInput[],
): Promise<LocalPath[]> {
  if (inputs.length === 0) return [];

  const maxNumero = await prisma.localPath.aggregate({
    where: { codeInsee: codeCommune, deletedAt: null },
    _max: { numero: true },
  });
  let nextNumero = (maxNumero._max.numero ?? 0) + 1;

  return prisma
    .$transaction(
      inputs.map((input) =>
        prisma.localPath.create({
          data: {
            codeInsee: codeCommune,
            nom: input.nom,
            statut: LocalPathStatusEnum.DRAFT,
            classement: input.classement,
            numero: input.numero ?? nextNumero++,
            segments: { create: segmentsCreateData(input.segments) },
          },
          select: SELECT,
        }),
      ),
    )
    .then((rows) => rows.map((r) => toDomain(r as unknown as Row)));
}
