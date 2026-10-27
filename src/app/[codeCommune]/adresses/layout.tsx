import { redirect } from "next/navigation";
import { getEnabledPlugins } from "@/plugins/registry";
import { requireSession } from "@/lib/auth/session";
import { PluginLayout } from "@/layouts/PluginLayout";
import { getCommuneFlag } from "@/lib/api/blason-commune";
import { PluginNotFound } from "@/components/plugin-workspace/PluginNotFound";
import { getCommuneBalsForClient } from "@/lib/api-bal/bal-access";
import { BalSelectToolbar } from "@/components/adresses/BalSelectToolbar";
import { BalChangesProvider } from "@/components/adresses/bal-changes";
import { ReactNode } from "react";

const PLUGIN_ID = "adresses";

export default async function AdressesLayout({
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

  const [communeFlagUrl, bals] = await Promise.all([
    getCommuneFlag(session.communeInsee),
    getCommuneBalsForClient(session),
  ]);

  return (
    <PluginLayout
      pluginId={currentPlugin.id}
      pluginLabel={currentPlugin.label}
      communeFlagUrl={communeFlagUrl}
    >
      <BalChangesProvider>
        <BalSelectToolbar bals={bals} />
        {children}
      </BalChangesProvider>
    </PluginLayout>
  );
}
