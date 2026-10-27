import { requireBalClient } from "@/lib/api-bal/bal-client";
import { findBaseLocaleVoies } from "@/lib/api-bal/generated/sdk.gen";
import { NameList } from "@/components/adresses/list/NameList";
import { toNameListItems } from "@/components/adresses/list/name-list.utils";

export default async function BalVoiesPage({
  params,
}: {
  params: Promise<{ codeCommune: string; balId: string }>;
}) {
  const { codeCommune, balId } = await params;
  const client = await requireBalClient(balId);

  const { data: voies } = await findBaseLocaleVoies({
    client,
    path: { baseLocaleId: balId },
    throwOnError: true,
  });

  return (
    <NameList
      items={toNameListItems(voies)}
      label="Liste des voies"
      searchLabel="Rechercher une voie"
      hrefPrefix={`/${codeCommune}/adresses/${balId}/voies`}
      addHref={`/${codeCommune}/adresses/${balId}/voies/new`}
      addLabel="Ajouter une voie"
      deletable={{ balId, kind: "voie" }}
    />
  );
}
