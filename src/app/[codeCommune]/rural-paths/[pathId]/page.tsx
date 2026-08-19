import { notFound } from "next/navigation";
import { getPluginById } from "@/plugins/registry";
import { requireSession } from "@/lib/auth/session";
import { getRuralPathById } from "@/lib/db/rural-paths";
import { RuralPathForm } from "@/components/rural-path/RuralPathForm";
import { PluginLayout } from "@/layouts/PluginLayout";
import { getCommuneFlag } from "@/lib/api/blason-commune";

const PLUGIN_ID = "rural-paths";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RuralPathDetailPage({
  params,
}: {
  params: Promise<{ codeCommune: string; pathId: string }>;
}) {
  const { pathId } = await params;
  if (!UUID_RE.test(pathId)) notFound();

  const plugin = getPluginById(PLUGIN_ID);
  if (!plugin) notFound();

  const session = await requireSession();
  const [ruralPath, communeFlagUrl] = await Promise.all([
    getRuralPathById(session.communeInsee, pathId),
    getCommuneFlag(session.communeInsee),
  ]);
  if (!ruralPath) notFound();

  return (
    <PluginLayout
      pluginId={plugin.id}
      pluginLabel={plugin.label}
      communeFlagUrl={communeFlagUrl}
    >
      <RuralPathForm codeCommune={session.communeInsee} initial={ruralPath} />
    </PluginLayout>
  );
}
