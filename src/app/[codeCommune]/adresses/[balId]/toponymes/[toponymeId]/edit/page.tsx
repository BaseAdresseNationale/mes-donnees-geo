import { requireBalClient, requireBalToponyme } from "@/lib/api-bal/bal-client";
import {
  findBaseLocaleVoies,
  findToponymeNumeros,
} from "@/lib/api-bal/generated/sdk.gen";
import { compareNumerosByVoie } from "@/lib/api-bal/numeros";
import { BboxMapEffects } from "@/components/adresses/detail/BboxMapEffects";
import { ToponymeForm } from "@/components/adresses/toponyme/ToponymeForm";

export default async function ToponymeEditPage({
  params,
}: {
  params: Promise<{ codeCommune: string; balId: string; toponymeId: string }>;
}) {
  const { codeCommune, balId, toponymeId } = await params;
  const client = await requireBalClient(balId);

  const [toponyme, { data: numeros }, { data: voies }] = await Promise.all([
    requireBalToponyme(balId, toponymeId),
    findToponymeNumeros({ client, path: { toponymeId }, throwOnError: true }),
    findBaseLocaleVoies({
      client,
      path: { baseLocaleId: balId },
      throwOnError: true,
    }),
  ]);

  return (
    <>
      <BboxMapEffects bbox={toponyme.bbox} />
      <ToponymeForm
        balId={balId}
        toponyme={toponyme}
        // Seuls id et libellé partent au navigateur
        numeros={numeros.toSorted(compareNumerosByVoie).map((numero) => ({
          id: numero.id,
          label: [numero.numeroComplet, numero.voie?.nom]
            .filter(Boolean)
            .join(" "),
        }))}
        voieNames={Object.fromEntries(voies.map(({ id, nom }) => [id, nom]))}
        toponymesHref={`/${codeCommune}/adresses/${balId}/toponymes`}
      />
    </>
  );
}
