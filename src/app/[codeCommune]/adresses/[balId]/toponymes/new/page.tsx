import { requireBalClient } from "@/lib/api-bal/bal-client";
import { findBaseLocaleVoies } from "@/lib/api-bal/generated/sdk.gen";
import { ToponymeForm } from "@/components/adresses/toponyme/ToponymeForm";

export default async function ToponymeNewPage({
  params,
}: {
  params: Promise<{ codeCommune: string; balId: string }>;
}) {
  const { codeCommune, balId } = await params;
  const client = await requireBalClient(balId);

  // Noms des voies, pour étiqueter les numéros trouvés par contour
  const { data: voies } = await findBaseLocaleVoies({
    client,
    path: { baseLocaleId: balId },
    throwOnError: true,
  });

  return (
    <ToponymeForm
      balId={balId}
      voieNames={Object.fromEntries(voies.map(({ id, nom }) => [id, nom]))}
      toponymesHref={`/${codeCommune}/adresses/${balId}/toponymes`}
    />
  );
}
