import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { createRuralPath } from "@/lib/db/chemins-ruraux";
import { validateRuralPathInput } from "@/components/chemins-ruraux/validation";

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

  const validation = validateRuralPathInput(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 422 });
  }

  const created = await createRuralPath(session.communeInsee, validation.data);
  return NextResponse.json(created, { status: 201 });
}
