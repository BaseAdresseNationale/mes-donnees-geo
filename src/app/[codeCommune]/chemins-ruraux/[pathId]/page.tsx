import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getRuralPathById } from "@/lib/db/chemins-ruraux";
import { RuralPathForm } from "@/components/CheminsRuraux/RuralPathForm";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RuralPathDetailPage({
  params,
}: {
  params: Promise<{ codeCommune: string; pathId: string }>;
}) {
  const { pathId } = await params;
  if (!UUID_RE.test(pathId)) notFound();

  const session = await requireSession();
  const ruralPath = await getRuralPathById(session.communeInsee, pathId);
  if (!ruralPath) notFound();

  return (
    <RuralPathForm codeCommune={session.communeInsee} initial={ruralPath} />
  );
}
