import { requireSession } from "@/lib/auth/session";
import { getRuralPaths } from "@/plugins/chemins-ruraux";
import { RuralPathList } from "@/components/CheminsRuraux/RuralPathList";

export default async function RuralPathsListPage() {
  const session = await requireSession();

  const paths = await getRuralPaths(session.communeInsee);

  return <RuralPathList codeCommune={session.communeInsee} paths={paths} />;
}
