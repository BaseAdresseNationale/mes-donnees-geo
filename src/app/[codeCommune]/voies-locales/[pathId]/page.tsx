import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getLocalPathById, getLocalPaths } from "@/lib/db/voies-locales";
import { LocalPathForm } from "@/components/voies-locales/form/LocalPathForm";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function LocalPathDetailPage({
  params,
}: {
  params: Promise<{ codeCommune: string; pathId: string }>;
}) {
  const { pathId } = await params;
  if (!UUID_RE.test(pathId)) notFound();

  const session = await requireSession();
  const localPath = await getLocalPathById(session.communeInsee, pathId);
  if (!localPath) notFound();

  const allPaths = await getLocalPaths(session.communeInsee);
  const otherPaths = allPaths.filter((p) => p.id !== localPath.id);

  return (
    <LocalPathForm
      codeCommune={session.communeInsee}
      initial={localPath}
      otherPaths={otherPaths}
    />
  );
}
