import { notFound } from "next/navigation";
import { requireBalClient } from "@/lib/api-bal/bal-client";
import { findVoie, findVoieNumeros } from "@/lib/api-bal/generated/sdk.gen";
import { NameList } from "@/components/adresses/list/NameList";
import { DetailHeader } from "@/components/adresses/detail/DetailHeader";
import { BboxMapEffects } from "@/components/adresses/detail/BboxMapEffects";

// Identifiant au format ObjectId (24 caractères hexadécimaux)
const OBJECT_ID_RE = /^[0-9a-f]{24}$/i;

export default async function VoiePage({
  params,
}: {
  params: Promise<{ codeCommune: string; balId: string; voieId: string }>;
}) {
  const { balId, voieId } = await params;
  const client = await requireBalClient(balId);
  if (!OBJECT_ID_RE.test(voieId)) notFound();

  const [voieResult, numerosResult] = await Promise.all([
    findVoie({ client, path: { voieId } }),
    findVoieNumeros({ client, path: { voieId } }),
  ]);

  // Les lectures de l'API sont publiques : on vérifie que la voie appartient
  // bien à la BAL de l'URL.
  const voie = voieResult.data;
  if (voieResult.response?.status === 404 || (voie && voie.balId !== balId)) {
    notFound();
  }
  if (!voie || !numerosResult.data) {
    throw new Error(
      `Impossible de récupérer la voie ${voieId} (HTTP ${voieResult.response?.status} / ${numerosResult.response?.status}).`,
    );
  }

  return (
    <>
      <BboxMapEffects bbox={voie.bbox} />
      <DetailHeader nom={voie.nom} nbNumeros={voie.nbNumeros} />
      <NameList
        // Ordre de l'API conservé (numéro puis suffixe) : pas de tri par nom
        items={numerosResult.data.map((numero) => ({
          id: numero.id,
          nom: numero.numeroComplet,
        }))}
        label="Numéros de la voie"
        searchLabel="Rechercher un numéro"
        emptyMessage="Aucun numéro sur cette voie."
      />
    </>
  );
}
