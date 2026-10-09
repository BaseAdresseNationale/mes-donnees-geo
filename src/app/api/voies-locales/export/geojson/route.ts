import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getLocalPaths } from "@/lib/db/voies-locales";
import { buildExportRows, toGeoJson } from "@/lib/export/voies-locales-export";

export async function GET(): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const paths = await getLocalPaths(session.communeInsee);
  const geojson = toGeoJson(buildExportRows(paths));

  return new Response(JSON.stringify(geojson), {
    headers: {
      "Content-Type": "application/geo+json; charset=utf-8",
      "Content-Disposition": `attachment; filename="voies-locales-${encodeURIComponent(session.communeInsee)}.geojson"`,
      "Cache-Control": "no-store",
    },
  });
}
