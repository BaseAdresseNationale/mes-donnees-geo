import "server-only";
import { prisma } from "./prisma";
import { getImportedSourceRefs } from "./voies-locales";
import { LocalPathSource } from "@/components/voies-locales/types";
import type { AssembledLocalPathResponse } from "@/components/voies-locales/import/types";

function hasSourceRefs(result: unknown): result is AssembledLocalPathResponse[] {
  return Array.isArray(result) && result.every((path) =>
    path !== null && typeof path === "object" && Array.isArray(path.segments) &&
    path.segments.every((segment: unknown) =>
      segment !== null && typeof segment === "object" && "sourceRef" in segment &&
      (segment.sourceRef === null || typeof segment.sourceRef === "string"),
    ),
  );
}

export async function getCachedBdTopoPreviewJob(codeInsee: string) {
  const job = await prisma.bdTopoImportJob.findFirst({
    where: {
      codeInsee,
      kind: "preview",
      status: "succeeded",
    },
    orderBy: { finishedAt: "desc" },
    select: { id: true, result: true },
  });
  return job && hasSourceRefs(job.result) ? { id: job.id } : null;
}

export async function refreshPreviewImportStatus(codeInsee: string, result: unknown) {
  if (!hasSourceRefs(result)) return result;
  const importedRefs = await getImportedSourceRefs(codeInsee, LocalPathSource.BD_TOPO);
  return result.map((path) => {
    const refs = path.segments
      .filter((segment) => segment.source === LocalPathSource.BD_TOPO)
      .map((segment) => segment.sourceRef)
      .filter((ref): ref is string => typeof ref === "string");
    return {
      ...path,
      alreadyImported: refs.length > 0 && refs.every((ref) => importedRefs.has(ref)),
    };
  });
}