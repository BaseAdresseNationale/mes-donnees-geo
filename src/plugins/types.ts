import type { ComponentType } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { z } from "zod";

export type GeometryKind = "Point" | "LineString" | "Polygon";

/**
 * Style MapLibre minimal appliqué à la couche du plugin.
 * On reste volontairement simple ici — chaque plugin peut fournir un style
 * complet via `mapLayers` si besoin.
 */
export interface PluginLayerStyle {
  color: string;
  outlineColor?: string;
  circleRadius?: number;
  lineWidth?: number;
  fillOpacity?: number;
}

export interface AttributesFormProps<TProps extends Record<string, unknown>> {
  feature: Feature<Geometry, TProps>;
  onChange: (next: TProps) => void;
  disabled?: boolean;
}

export interface PluginContext {
  communeInsee: string;
}

/**
 * Contrat que doit implémenter chaque plugin métier.
 * `TProps` = forme des attributs métier portés par chaque feature.
 */
export interface GeoPlugin<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
  readonly geometryTypes: readonly GeometryKind[];
  readonly requiredScopes: readonly string[];

  readonly propsSchema: z.ZodType<TProps, z.ZodTypeDef, unknown>;
  readonly defaultProps: TProps;

  readonly layerStyle: PluginLayerStyle;

  loadFeatures(
    ctx: PluginContext,
  ): Promise<FeatureCollection<Geometry, TProps>>;

  AttributesForm: ComponentType<AttributesFormProps<TProps>>;
}

// Type effacé pour le registry : les plugins ont des `TProps` différents,
// on manipule le registre via un type covariant en acceptant `any` ici.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGeoPlugin = GeoPlugin<any>;
