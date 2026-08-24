import { requireSession } from "@/lib/auth/session";
import { RuralPathForm } from "@/components/chemins-ruraux/form/RuralPathForm";

export default async function RuralPathNewPage() {
  const session = await requireSession();

  return <RuralPathForm codeCommune={session.communeInsee} />;
}
