import { z } from "zod";
import type { GeoPlugin } from "@/plugins/types";
import { featureRepository } from "@/lib/repository";
import { DemoAttributesForm } from "./DemoAttributesForm";

export const demoPropsSchema = z.object({
  nom: z.string().default(""),
  note: z.string().default(""),
});

export type DemoProps = z.infer<typeof demoPropsSchema>;

export const demoPlugin: GeoPlugin<DemoProps> = {
  id: "demo",
  label: "Démo",
  description: "Plugin d'exemple ",
  icon: "📍",
  geometryTypes: ["Point"],
  requiredScopes: [],
  propsSchema: demoPropsSchema,
  defaultProps: { nom: "", note: "" },
  layerStyle: {
    color: "#0055ff",
    circleRadius: 7,
  },
  async loadFeatures(ctx) {
    const fc = await featureRepository.list({
      communeInsee: ctx.communeInsee,
      pluginId: "demo",
    });
    return fc as Awaited<ReturnType<GeoPlugin<DemoProps>["loadFeatures"]>>;
  },
  AttributesForm: DemoAttributesForm,
};
