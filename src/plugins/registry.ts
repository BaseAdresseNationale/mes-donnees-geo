import type { AnyGeoPlugin } from "./types";
import { demoPlugin } from "./demo";
import { ruralPathsPlugin } from "./rural-paths";

/**
 * Catalogue de tous les plugins connus de l'application.
 * L'activation par commune se fait via `getEnabledPlugins`.
 */
const ALL_PLUGINS: readonly AnyGeoPlugin[] = [demoPlugin, ruralPathsPlugin];

/**
 * En attendant une vraie table `commune_plugins`, on active tous les plugins
 * pour toutes les communes. À remplacer par une lecture DB.
 */
export async function getEnabledPlugins(
  _communeInsee: string,
): Promise<readonly AnyGeoPlugin[]> {
  return ALL_PLUGINS;
}

export function getPluginById(pluginId: string): AnyGeoPlugin | undefined {
  return ALL_PLUGINS.find((p) => p.id === pluginId);
}

export function listAllPlugins(): readonly AnyGeoPlugin[] {
  return ALL_PLUGINS;
}
