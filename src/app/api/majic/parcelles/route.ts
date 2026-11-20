import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { findMajicParcelles } from "@/lib/majic/client";

export async function GET(): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    return NextResponse.json(await findMajicParcelles(session.communeInsee));
  } catch (error) {
    console.error("Erreur lors de la récupération des parcelles MAJIC", error);
    return NextResponse.json(
      { error: "Impossible de récupérer les parcelles MAJIC" },
      { status: 502 },
    );
  }
}
