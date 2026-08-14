import { notFound } from "next/navigation";
import { getPluginById } from "@/plugins/registry";
import { requireSession } from "@/lib/auth/session";
import { PluginLayout } from "@/layouts/PluginLayout";
import { getCommuneFlag } from "@/lib/api/blason-commune";

export default async function PluginPage({
  params,
}: {
  params: Promise<{ codeCommune: string; plugin: string }>;
}) {
  const { plugin: pluginId } = await params;
  const plugin = getPluginById(pluginId);
  if (!plugin) notFound();

  const session = await requireSession();
  const initialData = await plugin.loadFeatures({
    communeInsee: session.communeInsee,
  });
  const communeFlagUrl = await getCommuneFlag(session.communeInsee);

  return (
    <PluginLayout
      pluginId={plugin.id}
      pluginLabel={plugin.label}
      communeFlagUrl={communeFlagUrl}
    >
      <div>{JSON.stringify(initialData)}</div>
    </PluginLayout>
  );
}
