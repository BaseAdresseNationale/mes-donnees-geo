import { requireBalClient, requireBalToponyme } from "@/lib/api-bal/bal-client";
import { findToponymeNumeros } from "@/lib/api-bal/generated/sdk.gen";
import type { Numero } from "@/lib/api-bal/generated/types.gen";
import { compareNumerosByVoie } from "@/lib/api-bal/numeros";
import {
  NumerosByVoie,
  type VoieNumeros,
} from "@/components/adresses/detail/NumerosByVoie";
import { DetailHeader } from "@/components/adresses/detail/DetailHeader";
import { BboxMapEffects } from "@/components/adresses/detail/BboxMapEffects";

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
  const { codeCommune, balId, toponymeId } = await params;

  const [toponyme, { data: numeros }] = await Promise.all([
    requireBalToponyme(balId, toponymeId),
    requireBalClient(balId).then((client) =>
      findToponymeNumeros({ client, path: { toponymeId }, throwOnError: true }),
    ),
  ]);

  return (
    <>
      <BboxMapEffects bbox={toponyme.bbox} />
      <DetailHeader
        nom={toponyme.nom}
        nbNumeros={toponyme.nbNumeros}
        editHref={`/${codeCommune}/adresses/${balId}/toponymes/${toponymeId}/edit`}
        editLabel="Modifier le toponyme"
      />
      <NumerosByVoie
        voies={groupByVoie(numeros.toSorted(compareNumerosByVoie))}
        emptyMessage="Aucun numéro associé à ce toponyme."
      />
    </>
  );
}
