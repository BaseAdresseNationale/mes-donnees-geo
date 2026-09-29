import { localPathsPlugin } from "./voies-locales/config";
import { adressesPlugin } from "./adresses/config";
import { limitesAdministrativesPlugin } from "./limites-administratives/config";
import { GeoPlugin } from "./types";

export const ALL_PLUGINS: readonly GeoPlugin[] = [
  localPathsPlugin,
  adressesPlugin,
  limitesAdministrativesPlugin,
];
