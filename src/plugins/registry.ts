import "server-only";

import { getCommuneSettings } from "@/lib/db/commune-settings";
import { GeoPlugin } from "./types";
import { ruralPathsPlugin } from "./chemins-ruraux/config";
import { adressesPlugin } from "./adresses/config";
import { limitesAdministrativesPlugin } from "./limites-administratives/config";

const ALL_PLUGINS: readonly GeoPlugin[] = [
  ruralPathsPlugin,
  adressesPlugin,
  limitesAdministrativesPlugin,
];

export async function getEnabledPlugins(
  communeInsee: string,
): Promise<readonly GeoPlugin[]> {
  const settings = await getCommuneSettings(communeInsee);
  const disabled = new Set(settings.disabledPlugins);
  return ALL_PLUGINS.filter((p) => !disabled.has(p.id));
}

export function getPluginById(pluginId: string): GeoPlugin | undefined {
  return ALL_PLUGINS.find((p) => p.id === pluginId);
}

export function listAllPlugins(): readonly GeoPlugin[] {
  return ALL_PLUGINS;
}
