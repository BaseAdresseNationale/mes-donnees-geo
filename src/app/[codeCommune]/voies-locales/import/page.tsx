import { requireSession } from "@/lib/auth/session";
import { LocalPathImportBdTopo } from "@/components/voies-locales/import/LocalPathImportBdTopo";

export default async function LocalPathImportBdTopoPage() {
  const session = await requireSession();

  return <LocalPathImportBdTopo codeCommune={session.communeInsee} />;
}
