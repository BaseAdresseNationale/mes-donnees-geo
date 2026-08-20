import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireSession } from "@/lib/auth/session";
import { getEnabledPlugins } from "@/plugins/registry";
import { PluginNotFound } from "@/components/plugin-workspace/PluginNotFound";
import { getCommuneFlag } from "@/lib/api/blason-commune";
import { PluginLayout } from "@/layouts/PluginLayout";
import { RuralPathToolbar } from "@/components/chemins-ruraux/CheminsRurauxToolbar";
import { CommuneSettings } from "@/components/plugin-workspace/CommuneSettings";

const PLUGIN_ID = "chemins-ruraux";

export default async function CheminsRurauxLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSession();

  const enabledPlugins = await getEnabledPlugins(session.communeInsee);
  const currentPlugin = enabledPlugins.find((p) => p.id === PLUGIN_ID);
  const firstEnabledPlugin = enabledPlugins[0];

  if (!currentPlugin) {
    if (firstEnabledPlugin) {
      redirect(`/${session.communeInsee}/${firstEnabledPlugin.id}`);
    } else {
      return <PluginNotFound />;
    }
  }

  const communeFlagUrl = await getCommuneFlag(session.communeInsee);

  return (
    <PluginLayout
      pluginId={currentPlugin.id}
      pluginLabel={currentPlugin.label}
      toolbarChildren={<RuralPathToolbar codeCommune={session.communeInsee} />}
      rightHeaderContentChildren={
        <CommuneSettings
          currentPluginId={currentPlugin.id}
          communeFlagUrl={communeFlagUrl}
        />
      }
    >
      {children}
    </PluginLayout>
  );
}
