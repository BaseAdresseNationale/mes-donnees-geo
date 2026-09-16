import { requireSession } from "@/lib/auth/session";
import { RuralPathImportBdTopo } from "@/components/chemins-ruraux/import/RuralPathImportBdTopo";

export default async function RuralPathImportBdTopoPage() {
  const session = await requireSession();

  return <RuralPathImportBdTopo codeCommune={session.communeInsee} />;
}
