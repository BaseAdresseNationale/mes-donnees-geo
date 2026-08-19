import { notFound } from "next/navigation";
import { getPluginById } from "@/plugins/registry";
import { requireSession } from "@/lib/auth/session";
import { RuralPathForm } from "@/components/rural-path/RuralPathForm";
import { PluginLayout } from "@/layouts/PluginLayout";
import { getCommuneFlag } from "@/lib/api/blason-commune";

const PLUGIN_ID = "rural-paths";

export default async function RuralPathNewPage() {
  const plugin = getPluginById(PLUGIN_ID);
  if (!plugin) notFound();

  const session = await requireSession();
  const communeFlagUrl = await getCommuneFlag(session.communeInsee);

  return (
    <PluginLayout
      pluginId={plugin.id}
      pluginLabel={plugin.label}
      communeFlagUrl={communeFlagUrl}
    >
      <RuralPathForm codeCommune={session.communeInsee} />
    </PluginLayout>
  );
}
