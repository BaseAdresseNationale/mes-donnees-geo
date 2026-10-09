import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { publishLocalPaths } from "@/lib/db/publications";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const ids = (body as { ids?: unknown } | null)?.ids;
  if (
    !Array.isArray(ids) ||
    ids.length > 10_000 ||
    !ids.every((id) => typeof id === "string" && UUID_RE.test(id))
  ) {
    return NextResponse.json({ error: "Sélection invalide." }, { status: 422 });
  }

  try {
    const result = await publishLocalPaths(
      session.communeInsee,
      session.email,
      ids,
    );
    if (!result) {
      return NextResponse.json(
        { error: "Aucun changement à publier." },
        { status: 409 },
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Échec de la publication", error);
    return NextResponse.json(
      { error: "La publication a échoué." },
      { status: 502 },
    );
  }
}
