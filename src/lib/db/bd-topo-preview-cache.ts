import "server-only";
import { prisma } from "./prisma";
import { getImportedSourceRefs } from "./voies-locales";
import { LocalPathSource } from "@/components/voies-locales/types";
import type { AssembledLocalPathResponse } from "@/components/voies-locales/import/types";

function isStoredPreview(
  result: unknown,
): result is AssembledLocalPathResponse[] {
  return (
    Array.isArray(result) &&
    result.every(
      (path) =>
        path !== null &&
        typeof path === "object" &&
        Array.isArray(path.segments) &&
        path.segments.every(
          (segment: unknown) =>
            segment !== null &&
            typeof segment === "object" &&
            "sourceRef" in segment &&
            (segment.sourceRef === null ||
              typeof segment.sourceRef === "string") &&
            "type" in segment &&
            typeof segment.type === "string" &&
            "largeurMoyenne" in segment,
        ),
    )
  );
}

function isPathAlreadyImported(
  path: AssembledLocalPathResponse,
  importedRefs: Set<string>,
): boolean {
  const refs = path.segments
    .filter((segment) => segment.source === LocalPathSource.BD_TOPO)
    .map((segment) => segment.sourceRef)
    .filter((ref): ref is string => typeof ref === "string");
  return refs.length > 0 && refs.every((ref) => importedRefs.has(ref));
}

export function markAlreadyImported(
  paths: AssembledLocalPathResponse[],
  importedRefs: Set<string>,
): AssembledLocalPathResponse[] {
  return paths.map((path) => ({
    ...path,
    alreadyImported: isPathAlreadyImported(path, importedRefs),
  }));
}

function findLatestPreview(codeInsee: string) {
  return prisma.bdTopoImportJob.findFirst({
    where: { codeInsee, kind: "preview", status: "succeeded" },
    orderBy: { finishedAt: "desc" },
    select: { id: true, result: true },
  });
}

export async function getCachedBdTopoPreviewJob(codeInsee: string) {
  const job = await findLatestPreview(codeInsee);
  return job && isStoredPreview(job.result) ? { id: job.id } : null;
}

/** Dernier aperçu exploitable (réutilisé à l'import), avec `alreadyImported` à jour. */
export async function getCachedBdTopoPreviewPaths(
  codeInsee: string,
): Promise<AssembledLocalPathResponse[] | null> {
  const job = await findLatestPreview(codeInsee);
  if (!job || !isStoredPreview(job.result)) return null;
  return markAlreadyImported(
    job.result,
    await getImportedSourceRefs(codeInsee, LocalPathSource.BD_TOPO),
  );
}

export async function refreshPreviewImportStatus(
  codeInsee: string,
  result: unknown,
) {
  if (!isStoredPreview(result)) return result;
  return markAlreadyImported(
    result,
    await getImportedSourceRefs(codeInsee, LocalPathSource.BD_TOPO),
  );
}
