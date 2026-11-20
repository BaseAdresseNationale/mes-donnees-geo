import { NextResponse } from "next/server";
import type { FeatureCollection, LineString } from "geojson";
import { requireSession } from "@/lib/auth/session";
import {
  CadastreService,
  type CadastralLocalPathProperties,
} from "@/lib/geo/cadastre";

export async function GET(): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const featureCollection: FeatureCollection<
      LineString,
      CadastralLocalPathProperties
    > = {
      type: "FeatureCollection",
      features: await CadastreService.findLocalPathToponymsForCommune(
        session.communeInsee,
      ),
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
