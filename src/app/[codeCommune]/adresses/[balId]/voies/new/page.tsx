import { requireBalClient } from "@/lib/api-bal/bal-client";
import { VoieForm } from "@/components/adresses/voie/VoieForm";

export default async function VoieNewPage({
  params,
}: {
  params: Promise<{ codeCommune: string; balId: string }>;
}) {
  const { codeCommune, balId } = await params;
  // Contrôle d'accès à la BAL (déjà fait par le layout, mis en cache)
  await requireBalClient(balId);

  return (
    <VoieForm
      balId={balId}
      voiesHref={`/${codeCommune}/adresses/${balId}/voies`}
    />
  );
}
