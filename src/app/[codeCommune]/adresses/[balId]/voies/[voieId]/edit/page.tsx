import { requireBalVoie } from "@/lib/api-bal/bal-client";
import { BboxMapEffects } from "@/components/adresses/detail/BboxMapEffects";
import { VoieForm } from "@/components/adresses/voie/VoieForm";

export default async function VoieEditPage({
  params,
}: {
  params: Promise<{ codeCommune: string; balId: string; voieId: string }>;
}) {
  const { codeCommune, balId, voieId } = await params;
  const voie = await requireBalVoie(balId, voieId);

  return (
    <>
      <BboxMapEffects bbox={voie.bbox} />
      <VoieForm
        balId={balId}
        voie={voie}
        voiesHref={`/${codeCommune}/adresses/${balId}/voies`}
      />
    </>
  );
}
