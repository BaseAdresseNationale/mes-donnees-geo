import { NextResponse } from "next/server";
import type { Feature, FeatureCollection, LineString } from "geojson";
import { LocalPathClassement } from "@/generated/prisma/browser";
import { requireSession } from "@/lib/auth/session";
import {
  CadastreService,
  type CadastralRuralPathProperties,
} from "@/lib/geo/cadastre";

type CadastralLocalPathProperties = CadastralRuralPathProperties & {
  classement: LocalPathClassement;
};

export async function GET(): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const [ruralPaths, voiesCommunales] = await Promise.all([
      CadastreService.findRuralPathToponymsForCommune(session.communeInsee),
      CadastreService.findVoieCommunaleToponymsForCommune(session.communeInsee),
    ]);

    const tag = (
      features: Feature<LineString, CadastralRuralPathProperties>[],
      classement: LocalPathClassement,
    ): Feature<LineString, CadastralLocalPathProperties>[] =>
      features.map((feature) => ({
        ...feature,
        properties: { ...feature.properties, classement },
      }));

    const featureCollection: FeatureCollection<
      LineString,
      CadastralLocalPathProperties
    > = {
      type: "FeatureCollection",
      features: [
        ...tag(ruralPaths, LocalPathClassement.CHEMIN_RURAL),
        ...tag(voiesCommunales, LocalPathClassement.VOIE_COMMUNALE),
      ],
    };

    return NextResponse.json(featureCollection);
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des voies locales cadastrales",
      error,
    );
    return NextResponse.json(
      { error: "Impossible de récupérer les voies locales cadastrales" },
      { status: 502 },
    );
  }
}
