"use client";

import { useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { useModals } from "@gouvfr-lasuite/ui-components";
import MapContext from "@/contexts/MapContext";
import { createBalClient } from "@/lib/api-bal/browser-client";
import {
  deleteNumero,
  deleteToponyme,
  deleteVoie,
} from "@/lib/api-bal/generated/sdk.gen";
import { reloadBalTiles } from "@/components/map/bal/BalTilesMap";

export type DeleteKind = "voie" | "toponyme" | "numero";

// Textes de la confirmation selon le type d'élément (suppression définitive)
const CONFIRMATION: Record<
  DeleteKind,
  (nom: string) => { title: string; children: string }
> = {
  voie: (nom) => ({
    title: "Supprimer cette voie ?",
    children: `La voie « ${nom} » et tous ses numéros seront supprimés.`,
  }),
  toponyme: (nom) => ({
    title: "Supprimer ce toponyme ?",
    children: `Le toponyme « ${nom} » sera supprimé. Ses numéros sont conservés mais n'y seront plus rattachés.`,
  }),
  numero: (nom) => ({
    title: "Supprimer ce numéro ?",
    children: `Le numéro « ${nom} » sera supprimé.`,
  }),
};

// Suppression d'une voie (avec ses numéros), d'un toponyme (ses numéros sont
// détachés) ou d'un numéro de la BAL, après confirmation. mes-adresses-api
// enregistre l'événement correspondant ; la liste et la carte sont rechargées.
export function useDeleteItem(balId: string, kind: DeleteKind) {
  const router = useRouter();
  const modals = useModals();
  const { mapRef } = useContext(MapContext);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = useCallback(
    async (id: string, nom: string) => {
      const decision = await modals.deleteConfirmationModal(
        CONFIRMATION[kind](nom),
      );
      if (decision !== "delete") return;

      setError(null);
      setDeletingId(id);
      const client = createBalClient(balId);
      const { response } =
        kind === "voie"
          ? await deleteVoie({ client, path: { voieId: id } })
          : kind === "toponyme"
            ? await deleteToponyme({ client, path: { toponymeId: id } })
            : await deleteNumero({ client, path: { numeroId: id } });
      setDeletingId(null);

      if (!response?.ok) {
        setError(
          response?.status === 403
            ? "Cette Base Adresse Locale ne peut pas être modifiée pour le moment."
            : "La suppression a échoué. Réessayez.",
        );
        return;
      }

      reloadBalTiles(mapRef);
      router.refresh();
    },
    [balId, kind, modals, mapRef, router],
  );

  return { remove, deletingId, error };
}
