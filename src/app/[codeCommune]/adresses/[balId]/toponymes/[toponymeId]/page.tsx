import { notFound } from "next/navigation";
import { requireBalClient } from "@/lib/api-bal/bal-client";
import {
  findToponyme,
  findToponymeNumeros,
} from "@/lib/api-bal/generated/sdk.gen";
import type { Numero } from "@/lib/api-bal/generated/types.gen";
import {
  NumerosByVoie,
  type VoieNumeros,
} from "@/components/adresses/detail/NumerosByVoie";
import { DetailHeader } from "@/components/adresses/detail/DetailHeader";
import { BboxMapEffects } from "@/components/adresses/detail/BboxMapEffects";

// Identifiant au format ObjectId (24 caractères hexadécimaux)
const OBJECT_ID_RE = /^[0-9a-f]{24}$/i;

// Numéros triés par nom de voie, puis numéro, puis suffixe
function compareByVoie(a: Numero, b: Numero): number {
  return (
    (a.voie?.nom ?? "").localeCompare(b.voie?.nom ?? "", "fr") ||
    a.numero - b.numero ||
    (a.suffixe ?? "").localeCompare(b.suffixe ?? "", "fr")
  );
}

// Regroupe les numéros (déjà triés par voie) en une entrée par voie
function groupByVoie(numeros: Numero[]): VoieNumeros[] {
  const voies = new Map<string, VoieNumeros>();
  for (const numero of numeros) {
    const voieId = numero.voieId ?? "";
    const voie = voies.get(voieId) ?? {
      voieId,
      voieNom: numero.voie?.nom ?? "Sans voie",
      numeros: [],
    };
    voie.numeros.push({ id: numero.id, nom: numero.numeroComplet });
    voies.set(voieId, voie);
  }
  return [...voies.values()];
}

export default async function ToponymePage({
  params,
}: {
  params: Promise<{ codeCommune: string; balId: string; toponymeId: string }>;
}) {
  const { balId, toponymeId } = await params;
  const client = await requireBalClient(balId);
  if (!OBJECT_ID_RE.test(toponymeId)) notFound();

  const [toponymeResult, numerosResult] = await Promise.all([
    findToponyme({ client, path: { toponymeId } }),
    findToponymeNumeros({ client, path: { toponymeId } }),
  ]);

  // Les lectures de l'API sont publiques : on vérifie que le toponyme
  // appartient bien à la BAL de l'URL.
  const toponyme = toponymeResult.data;
  if (
    toponymeResult.response?.status === 404 ||
    (toponyme && toponyme.balId !== balId)
  ) {
    notFound();
  }
  if (!toponyme || !numerosResult.data) {
    throw new Error(
      `Impossible de récupérer le toponyme ${toponymeId} (HTTP ${toponymeResult.response?.status} / ${numerosResult.response?.status}).`,
    );
  }

  // L'API renvoie les numéros avec leur voie, sans ordre particulier
  const numeros = numerosResult.data.toSorted(compareByVoie);

  return (
    <>
      <BboxMapEffects bbox={toponyme.bbox} />
      <DetailHeader nom={toponyme.nom} nbNumeros={toponyme.nbNumeros} />
      <NumerosByVoie
        voies={groupByVoie(numeros)}
        emptyMessage="Aucun numéro associé à ce toponyme."
      />
    </>
  );
}
