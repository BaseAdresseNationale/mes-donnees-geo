"use client";

import { useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { useModals } from "@gouvfr-lasuite/ui-components";
import MapContext from "@/contexts/MapContext";
import { createBalClient } from "@/lib/api-bal/browser-client";
import {
  softDeleteNumero,
  softDeleteToponyme,
  softDeleteVoie,
} from "@/lib/api-bal/generated/sdk.gen";
import { reloadBalTiles } from "@/components/map/bal/BalTilesMap";

export type ArchiveKind = "voie" | "toponyme" | "numero";

// Textes de la confirmation selon le type d'élément
const CONFIRMATION: Record<
  ArchiveKind,
  (nom: string) => { title: string; children: string }
> = {
  voie: (nom) => ({
    title: "Archiver cette voie ?",
    children: `La voie « ${nom} » et ses numéros seront archivés.`,
  }),
  toponyme: (nom) => ({
    title: "Archiver ce toponyme ?",
    children: `Le toponyme « ${nom} » sera archivé.`,
  }),
  numero: (nom) => ({
    title: "Archiver ce numéro ?",
    children: `Le numéro « ${nom} » sera archivé.`,
  }),
};

// Archivage (suppression douce) d'une voie, d'un toponyme ou d'un numéro de
// la BAL, après confirmation. La liste et la carte sont ensuite rechargées.
export function useArchiveItem(balId: string, kind: ArchiveKind) {
  const router = useRouter();
  const modals = useModals();
  const { mapRef } = useContext(MapContext);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const archive = useCallback(
    async (id: string, nom: string) => {
      const decision = await modals.deleteConfirmationModal(
        CONFIRMATION[kind](nom),
      );
      if (decision !== "delete") return;

      setError(null);
      setArchivingId(id);
      const client = createBalClient(balId);
      const { response } =
        kind === "voie"
          ? await softDeleteVoie({ client, path: { voieId: id } })
          : kind === "toponyme"
            ? await softDeleteToponyme({ client, path: { toponymeId: id } })
            : await softDeleteNumero({ client, path: { numeroId: id } });
      setArchivingId(null);

      if (!response?.ok) {
        setError(
          response?.status === 403
            ? "Cette Base Adresse Locale ne peut pas être modifiée pour le moment."
            : "L'archivage a échoué. Réessayez.",
        );
        return;
      }

      reloadBalTiles(mapRef);
      router.refresh();
    },
    [balId, kind, modals, mapRef, router],
  );

  return { archive, archivingId, error };
}
