import { redirect } from "next/navigation";
import { getEnabledPlugins } from "@/plugins/registry";
import { PluginNotFound } from "@/components/plugin-workspace/PluginNotFound";

export default async function CommuneIndex({
  params,
}: {
  params: Promise<{ codeCommune: string }>;
}) {
  const { codeCommune } = await params;
  const enabledPlugins = await getEnabledPlugins(codeCommune);
  const firstEnabled = enabledPlugins[0];
  if (!firstEnabled) {
    return <PluginNotFound />;
  }
  redirect(`/${codeCommune}/${firstEnabled.id}`);
}
