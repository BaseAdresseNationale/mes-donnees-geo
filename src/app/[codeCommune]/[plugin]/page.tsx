import { notFound } from "next/navigation";
import { getPluginById } from "@/plugins/registry";
import { requireSession } from "@/lib/auth/session";
import { PluginWorkspace } from "@/components/PluginWorkspace/PluginWorkspace";

export default async function PluginPage({
  params,
}: {
  params: Promise<{ codeCommune: string; plugin: string }>;
}) {
  const { plugin: pluginId } = await params;
  const plugin = getPluginById(pluginId);
  if (!plugin) notFound();

  const session = await requireSession();
  const initialData = await plugin.loadFeatures({ communeInsee: session.communeInsee });

  return (
    <PluginWorkspace
      pluginId={plugin.id}
      pluginLabel={plugin.label}
      pluginDescription={plugin.description}
      geometryTypes={[...plugin.geometryTypes]}
      layerStyle={plugin.layerStyle}
      initialData={initialData}
    />
  );
}
