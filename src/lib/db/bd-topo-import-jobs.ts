import "server-only";
import turfLength from "@turf/length";
import { lineString } from "@turf/helpers";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import {
  createLocalPathsFromImport,
  getImportedSourceRefs,
} from "./voies-locales";
import { assembleForCommune } from "@/lib/geo/bd-topo-import";
import type { AssembledLocalPath } from "@/lib/geo/local-path-cadastre-matching";
import {
  LocalPathEtat,
  LocalPathSource,
} from "@/components/voies-locales/types";
import type { AssembledLocalPathResponse } from "@/components/voies-locales/import/types";
import {
  getCachedBdTopoPreviewPaths,
  markAlreadyImported,
  refreshPreviewImportStatus,
} from "./bd-topo-preview-cache";

const JOB_LIFETIME_MS = 30 * 60 * 1000;

async function expireJobs(codeInsee: string) {
  await prisma.bdTopoImportJob.updateMany({
    where: {
      codeInsee,
      status: "pending",
      createdAt: { lt: new Date(Date.now() - JOB_LIFETIME_MS) },
    },
    data: {
      status: "failed",
      error:
        "L'import a été interrompu ou a dépassé sa durée maximale. Vous pouvez le relancer.",
      finishedAt: new Date(),
    },
  });
}

export async function createBdTopoImportJob(
  codeInsee: string,
  kind: "import" | "preview" = "import",
) {
  await expireJobs(codeInsee);
  try {
    return await prisma.bdTopoImportJob.create({ data: { codeInsee, kind } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return null;
    }
    throw error;
  }
}

export async function getPendingBdTopoPreviewJob(codeInsee: string) {
  await expireJobs(codeInsee);
  return prisma.bdTopoImportJob.findFirst({
    where: { codeInsee, kind: "preview", status: "pending" },
    select: { id: true },
  });
}

export async function getBdTopoImportJob(codeInsee: string, id: string) {
  await expireJobs(codeInsee);
  const job = await prisma.bdTopoImportJob.findFirst({
    where: { id, codeInsee },
    select: {
      id: true,
      kind: true,
      status: true,
      created: true,
      error: true,
      result: true,
    },
  });
  if (job?.kind === "preview" && job.status === "succeeded") {
    return {
      ...job,
      result: await refreshPreviewImportStatus(codeInsee, job.result),
    };
  }
  return job;
}

function toPreviewResponse(
  assembled: AssembledLocalPath[],
): AssembledLocalPathResponse[] {
  return assembled.map((path) => ({
    key: path.key,
    numero: path.numero,
    nom: path.nom,
    classement: path.classement,
    segments: path.segments.map((segment) => ({
      path: segment.path,
      source: segment.source,
      sourceRef: segment.sourceRef,
      type: segment.type,
      revetement: segment.revetement,
      largeurMoyenne: segment.largeurMoyenne,
    })),
    longueur: path.segments.reduce(
      (sum, segment) =>
        sum +
        turfLength(lineString(segment.path.coordinates), { units: "meters" }),
      0,
    ),
    alreadyImported: false,
    couverture: path.couverture ?? null,
  }));
}

async function computePreviewPaths(
  codeInsee: string,
): Promise<AssembledLocalPathResponse[]> {
  const [assembled, importedRefs] = await Promise.all([
    assembleForCommune(codeInsee),
    getImportedSourceRefs(codeInsee, LocalPathSource.BD_TOPO),
  ]);
  return markAlreadyImported(toPreviewResponse(assembled), importedRefs);
}

export async function runBdTopoPreviewJob(
  id: string,
  codeInsee: string,
): Promise<void> {
  try {
    const result = await computePreviewPaths(codeInsee);
    await prisma.bdTopoImportJob.updateMany({
      where: {
        id,
        codeInsee,
        kind: "preview",
        status: "pending",
        createdAt: { gte: new Date(Date.now() - JOB_LIFETIME_MS) },
      },
      data: {
        status: "succeeded",
        result: result as unknown as Prisma.InputJsonValue,
        finishedAt: new Date(),
      },
    });
  } catch (error) {
    await recordJobFailure(id, codeInsee, error);
  }
}

async function recordJobFailure(id: string, codeInsee: string, error: unknown) {
  console.error("BD TOPO job failed", { id, codeInsee, error });
  try {
    await prisma.bdTopoImportJob.updateMany({
      where: { id, codeInsee, status: "pending" },
      data: {
        status: "failed",
        error: "Échec du traitement BD TOPO. Vous pouvez réessayer.",
        finishedAt: new Date(),
      },
    });
  } catch (statusError) {
    console.error("Could not persist BD TOPO job failure", { id, statusError });
  }
}

export async function runBdTopoImportJob(
  id: string,
  codeInsee: string,
  keys: string[],
): Promise<void> {
  try {
    // L'aperçu déjà calculé (celui que l'utilisateur a vu) évite de tout reconstituer.
    const paths =
      (await getCachedBdTopoPreviewPaths(codeInsee)) ??
      (await computePreviewPaths(codeInsee));
    const selectedKeys = new Set(keys);
    const inputs = paths
      .filter((path) => selectedKeys.has(path.key) && !path.alreadyImported)
      .map((path) => ({
        nom: path.nom,
        classement: path.classement,
        numero: path.numero,
        segments: path.segments.map((segment) => ({
          path: segment.path,
          type: segment.type,
          revetement: segment.revetement,
          largeurMoyenne: segment.largeurMoyenne,
          etat: LocalPathEtat.BON,
          fermeALaCirculation: null,
          servitudes: [],
          delimitation: null,
          source: segment.source,
          sourceRef: segment.sourceRef ?? null,
        })),
      }));

    await prisma.$transaction(
      async (tx) => {
        const claimed = await tx.bdTopoImportJob.updateMany({
          where: {
            id,
            codeInsee,
            status: "pending",
            createdAt: { gte: new Date(Date.now() - JOB_LIFETIME_MS) },
          },
          data: { status: "succeeded", finishedAt: new Date() },
        });
        if (claimed.count === 0) return;
        const created = await createLocalPathsFromImport(codeInsee, inputs, tx);
        await tx.bdTopoImportJob.update({
          where: { id },
          data: { created: created.length },
        });
      },
      { timeout: 60_000 },
    );
  } catch (error) {
    await recordJobFailure(id, codeInsee, error);
  }
}
