import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getLocalPaths } from "@/lib/db/voies-locales";
import { LocalPathStatus } from "@/generated/prisma/client";
import { buildExportRows, toCsv } from "@/lib/export/voies-locales-export";

export async function GET(): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const paths = await getLocalPaths(session.communeInsee, {
    statut: LocalPathStatus.QUALIFIEE,
  });
  const csv = toCsv(buildExportRows(paths));

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="voies-locales-${encodeURIComponent(session.communeInsee)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
