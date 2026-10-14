import { requireBalClient } from "@/lib/api-bal/bal-client";
import { findBaseLocaleToponymes } from "@/lib/api-bal/generated/sdk.gen";
import { NameList } from "@/components/adresses/list/NameList";
import { toNameListItems } from "@/components/adresses/list/name-list.utils";

export default async function BalToponymesPage({
  params,
}: {
  params: Promise<{ codeCommune: string; balId: string }>;
}) {
  const { codeCommune, balId } = await params;
  const client = await requireBalClient(balId);

  const { data: toponymes } = await findBaseLocaleToponymes({
    client,
    path: { baseLocaleId: balId },
    throwOnError: true,
  });

  return (
    <NameList
      items={toNameListItems(toponymes)}
      label="Liste des toponymes"
      searchLabel="Rechercher un toponyme"
      hrefPrefix={`/${codeCommune}/adresses/${balId}/toponymes`}
    />
  );
}
