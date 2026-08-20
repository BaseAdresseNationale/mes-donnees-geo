import { requireSession } from "@/lib/auth/session";
import { RuralPathList } from "@/components/chemins-ruraux/CheminsRurauxList";
import { getRuralPaths } from "@/plugins/chemins-ruraux";

export default async function RuralPathsListPage() {
  const session = await requireSession();
  const ruralPaths = await getRuralPaths(session.communeInsee);

  return (
    <RuralPathList codeCommune={session.communeInsee} ruralPaths={ruralPaths} />
  );
}
