import { notFound } from "next/navigation";
import { getPluginById } from "@/plugins/registry";
import { requireSession } from "@/lib/auth/session";
import { getRuralPaths } from "@/plugins/rural-paths";
import { RuralPathList } from "@/components/rural-path/RuralPathList";
import { PluginLayout } from "@/layouts/PluginLayout";
import { getCommuneFlag } from "@/lib/api/blason-commune";

const PLUGIN_ID = "rural-paths";

export default async function RuralPathsListPage() {
  const plugin = getPluginById(PLUGIN_ID);
  if (!plugin) notFound();

  const session = await requireSession();
  const [paths, communeFlagUrl] = await Promise.all([
    getRuralPaths(session.communeInsee),
    getCommuneFlag(session.communeInsee),
  ]);

  return (
    <PluginLayout
      pluginId={plugin.id}
      pluginLabel={plugin.label}
      communeFlagUrl={communeFlagUrl}
    >
      <RuralPathList codeCommune={session.communeInsee} paths={paths} />
    </PluginLayout>
  );
}
