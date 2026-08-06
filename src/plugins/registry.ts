import "server-only";
import type { AnyGeoPlugin } from "./types";
import { demoPlugin } from "./demo";
import { ruralPathsPlugin } from "./rural-paths";
import { getCommuneSettings } from "@/lib/db/commune-settings";

const ALL_PLUGINS: readonly AnyGeoPlugin[] = [demoPlugin, ruralPathsPlugin];

export async function getEnabledPlugins(
  communeInsee: string,
): Promise<readonly AnyGeoPlugin[]> {
  const settings = await getCommuneSettings(communeInsee);
  const disabled = new Set(settings.disabledPlugins);
  return ALL_PLUGINS.filter((p) => !disabled.has(p.id));
}

export function getPluginById(pluginId: string): AnyGeoPlugin | undefined {
  return ALL_PLUGINS.find((p) => p.id === pluginId);
}

export function listAllPlugins(): readonly AnyGeoPlugin[] {
  return ALL_PLUGINS;
}
