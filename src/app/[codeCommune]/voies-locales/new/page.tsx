import { requireSession } from "@/lib/auth/session";
import { getLocalPaths } from "@/lib/db/voies-locales";
import { LocalPathForm } from "@/components/voies-locales/form/LocalPathForm";

export default async function LocalPathNewPage() {
  const session = await requireSession();
  const otherPaths = await getLocalPaths(session.communeInsee);

  return (
    <LocalPathForm
      codeCommune={session.communeInsee}
      otherPaths={otherPaths}
    />
  );
}
