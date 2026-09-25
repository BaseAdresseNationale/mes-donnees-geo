import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { softDeleteLocalPath, updateLocalPath } from "@/lib/db/voies-locales";
import { validateLocalPathInput } from "@/components/voies-locales/validation";
import { LocalPathDeletionReason } from "@/generated/prisma/client";

interface RouteParams {
  params: Promise<{ pathId: string }>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DELETION_REASON_VALUES = new Set<string>(
  Object.values(LocalPathDeletionReason),
);

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

  const validation = validateLocalPathInput(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 422 });
  }

  const updated = await updateLocalPath(
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

  // Corps optionnel : la raison de suppression n'est pas toujours fournie
  // (ex. suppression d'un chemin fusionné, sans modal).
  let deletionReason: LocalPathDeletionReason | null = null;
  try {
    const body = (await request.json()) as { deletionReason?: unknown } | null;
    const raw = body?.deletionReason;
    if (raw != null) {
      if (typeof raw !== "string" || !DELETION_REASON_VALUES.has(raw)) {
        return NextResponse.json(
          { error: "Raison de suppression invalide." },
          { status: 422 },
        );
      }
      deletionReason = raw as LocalPathDeletionReason;
    }
  } catch {
    // Pas de corps JSON : suppression sans raison.
  }

  const deleted = await softDeleteLocalPath(
    session.communeInsee,
    pathId,
    deletionReason,
  );
  if (!deleted) {
    return NextResponse.json({ error: "Chemin introuvable" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
