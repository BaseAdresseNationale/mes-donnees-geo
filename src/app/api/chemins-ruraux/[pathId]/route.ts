import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { softDeleteRuralPath, updateRuralPath } from "@/lib/db/chemins-ruraux";
import { validateRuralPathInput } from "@/components/CheminsRuraux/validation";

interface RouteParams {
  params: Promise<{ pathId: string }>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PUT(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { pathId } = await params;
  if (!UUID_RE.test(pathId)) {
    return NextResponse.json(
      { error: "Identifiant invalide" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const validation = validateRuralPathInput(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 422 });
  }

  const updated = await updateRuralPath(
    session.communeInsee,
    pathId,
    validation.data,
  );
  if (!updated) {
    return NextResponse.json({ error: "Chemin introuvable" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: RouteParams,
): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { pathId } = await params;
  if (!UUID_RE.test(pathId)) {
    return NextResponse.json(
      { error: "Identifiant invalide" },
      { status: 400 },
    );
  }

  const deleted = await softDeleteRuralPath(session.communeInsee, pathId);
  if (!deleted) {
    return NextResponse.json({ error: "Chemin introuvable" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
