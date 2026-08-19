export interface PluginContext {
  communeInsee: string;
}

export interface GeoPlugin {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
}
