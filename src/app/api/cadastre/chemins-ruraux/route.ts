import { NextResponse } from "next/server";
import type { Feature, FeatureCollection, LineString } from "geojson";
import { requireSession } from "@/lib/auth/session";
import {
  CadastreService,
  type CadastralRuralPathProperties,
} from "@/lib/geo/cadastre";

export async function GET(): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const features: Feature<LineString, CadastralRuralPathProperties>[] =
      await CadastreService.findRuralPathToponymsForCommune(
        session.communeInsee,
      );
    const featureCollection: FeatureCollection<
      LineString,
      CadastralRuralPathProperties
    > = {
      type: "FeatureCollection",
      features,
    };

    return NextResponse.json(featureCollection);
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des chemins ruraux cadastraux",
      error,
    );
    return NextResponse.json(
      { error: "Impossible de récupérer les chemins ruraux cadastraux" },
      { status: 502 },
    );
  }
}
