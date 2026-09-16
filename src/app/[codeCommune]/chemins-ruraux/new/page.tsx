import { requireSession } from "@/lib/auth/session";
import { getRuralPaths } from "@/lib/db/chemins-ruraux";
import { RuralPathForm } from "@/components/chemins-ruraux/form/RuralPathForm";

export default async function RuralPathNewPage() {
  const session = await requireSession();
  const otherPaths = await getRuralPaths(session.communeInsee);

  return (
    <RuralPathForm
      codeCommune={session.communeInsee}
      otherPaths={otherPaths}
    />
  );
}
