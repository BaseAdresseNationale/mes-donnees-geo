import { z } from "zod";
import type { GeoPlugin } from "@/plugins/types";
import { featureRepository } from "@/lib/repository";
import { RuralPathAttributesForm } from "./RuralPathAttributesForm";

export const ruralPathPropsSchema = z.object({
  nom: z.string().default(""),
  revetement: z
    .enum(["terre", "gravier", "enrobe", "empierre", "herbe"])
    .default("terre"),
  statut: z.enum(["ouvert", "ferme", "a_verifier"]).default("ouvert"),
});

export type RuralPathProps = z.infer<typeof ruralPathPropsSchema>;

export const ruralPathsPlugin: GeoPlugin<RuralPathProps> = {
  id: "rural-paths",
  label: "Chemins ruraux",
  description: "Édition des chemins ruraux communaux",
  icon: "🥾",
  geometryTypes: ["LineString"],
  requiredScopes: ["rural-paths:write"],
  propsSchema: ruralPathPropsSchema,
  defaultProps: { nom: "", revetement: "terre", statut: "ouvert" },
  layerStyle: {
    color: "#8b5a2b",
    lineWidth: 4,
  },
  async loadFeatures(ctx) {
    const fc = await featureRepository.list({
      communeInsee: ctx.communeInsee,
      pluginId: "rural-paths",
    });
    return fc as Awaited<ReturnType<GeoPlugin<RuralPathProps>["loadFeatures"]>>;
  },
  AttributesForm: RuralPathAttributesForm,
};
