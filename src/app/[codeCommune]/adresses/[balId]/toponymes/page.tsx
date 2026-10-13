import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getServerBalClient } from "@/lib/api-bal/bal-access";
import { findBaseLocaleToponymes } from "@/lib/api-bal/generated/sdk.gen";
import { NameList } from "@/components/adresses/list/NameList";
import { toNameListItems } from "@/components/adresses/list/name-list.utils";

export default async function BalToponymesPage({
  params,
}: {
  params: Promise<{ codeCommune: string; balId: string }>;
}) {
  const { balId } = await params;
  const session = await requireSession();
  const client = await getServerBalClient(session, balId);
  if (!client) notFound();

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
    />
  );
}
