import "server-only";
import { LocalPathStatus } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { getDeletedLocalPathsWithReason, getLocalPaths } from "./voies-locales";
import {
  buildExportRows,
  toCsv,
  toGeoJson,
} from "@/lib/export/voies-locales-export";
import {
  computeChanges,
  toPublicChange,
  type ComputedChange,
  type PublishedEntry,
} from "@/lib/publication/diff";
import type {
  PublicationOverview,
  PublishedPath,
} from "@/lib/publication/types";
import { publishToDataGouv } from "@/lib/datagouv/client";

/** Dernier état publié de chaque voie de la commune. */
async function getPublishedState(
  codeCommune: string,
): Promise<Map<string, PublishedEntry>> {
  const rows = await prisma.$queryRaw<
    { localPathId: string; hash: string; snapshot: PublishedPath }[]
  >`
    SELECT DISTINCT ON (i.local_path_id)
      i.local_path_id::text AS "localPathId", i.hash, i.snapshot
    FROM local_path_publication_items i
    JOIN local_path_publications p ON p.id = i.publication_id
    WHERE p.code_insee = ${codeCommune}
    ORDER BY i.local_path_id, p.created_at DESC
  `;
  return new Map(
    rows.map((r) => [r.localPathId, { hash: r.hash, snapshot: r.snapshot }]),
  );
}

async function computeForCommune(codeCommune: string): Promise<{
  changes: ComputedChange[];
  published: Map<string, PublishedEntry>;
}> {
  const [qualified, published] = await Promise.all([
    getLocalPaths(codeCommune, { statut: LocalPathStatus.QUALIFIEE }),
    getPublishedState(codeCommune),
  ]);
  const currentIds = new Set(qualified.map((p) => p.id));
  // Une voie publiée qui n'est plus active est soit supprimée (motif), soit fusionnée (ignorée).
  const missingIds = [...published.keys()].filter((id) => !currentIds.has(id));
  const deleted = await getDeletedLocalPathsWithReason(codeCommune, missingIds);

  return {
    changes: computeChanges({ current: qualified, deleted, published }),
    published,
  };
}

export async function getPublicationOverview(
  codeCommune: string,
): Promise<PublicationOverview> {
  const { changes, published } = await computeForCommune(codeCommune);
  return {
    changes: changes.map(toPublicChange),
    publishedPathIds: [...published.keys()],
  };
}

export interface PublishResult {
  publishedCount: number;
}

/**
 * Publie les changements sélectionnés : l'état publié (hors sélection) est conservé tel quel.
 * Le différentiel est recalculé côté serveur, jamais repris du client.
 */
export async function publishLocalPaths(
  codeCommune: string,
  publishedBy: string | null,
  selectedIds: string[],
): Promise<PublishResult | null> {
  const { changes, published } = await computeForCommune(codeCommune);
  const selectedSet = new Set(selectedIds);
  const selected = changes.filter((c) => selectedSet.has(c.id));
  if (selected.length === 0) return null;

  const nextState = new Map(published);
  for (const change of selected) {
    nextState.set(change.id, { hash: change.hash, snapshot: change.snapshot });
  }

  const paths = [...nextState.values()]
    .map((e) => e.snapshot)
    .sort((a, b) => a.numero - b.numero || a.id.localeCompare(b.id));
  const rows = buildExportRows(paths);

  await publishToDataGouv({
    codeInsee: codeCommune,
    files: [
      {
        filename: `voies-locales-${codeCommune}.csv`,
        mimeType: "text/csv",
        content: toCsv(rows),
      },
      {
        filename: `voies-locales-${codeCommune}.geojson`,
        mimeType: "application/geo+json",
        content: JSON.stringify(toGeoJson(rows)),
      },
    ],
  });

  await prisma.localPathPublication.create({
    data: {
      codeInsee: codeCommune,
      publishedBy,
      changesCount: selected.length,
      items: {
        create: selected.map((c) => ({
          localPathId: c.id,
          hash: c.hash,
          snapshot: c.snapshot as unknown as Prisma.InputJsonValue,
        })),
      },
    },
  });

  return { publishedCount: selected.length };
}
