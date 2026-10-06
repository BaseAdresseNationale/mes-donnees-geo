import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { createCommuneBal, listCommuneBals } from "@/lib/api-bal/bal-access";
import { stripToken } from "@/lib/api-bal/proxy";

const NOM_MAX_LENGTH = 200;

// Liste des BAL de la commune de la session (sans les tokens).
export async function GET(): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const bals = await listCommuneBals(session);
    return NextResponse.json(stripToken(bals));
  } catch (error) {
    console.error("[api/adresses/bases-locales] GET", error);
    return NextResponse.json(
      { error: "mes-adresses-api indisponible" },
      { status: 502 },
    );
  }
}

// Création d'une BAL pour la commune de la session : seul le nom vient du
// navigateur, la commune et l'email sont tirés de la session.
export async function POST(request: Request): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const nom =
    body && typeof body === "object" && "nom" in body ? body.nom : undefined;
  if (typeof nom !== "string" || !nom.trim() || nom.length > NOM_MAX_LENGTH) {
    return NextResponse.json({ error: "Nom invalide" }, { status: 422 });
  }

  try {
    const bal = await createCommuneBal(session, nom.trim());
    return NextResponse.json(stripToken(bal), { status: 201 });
  } catch (error) {
    console.error("[api/adresses/bases-locales] POST", error);
    return NextResponse.json(
      { error: "mes-adresses-api indisponible" },
      { status: 502 },
    );
  }
}
