import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { createLocalPath } from "@/lib/db/voies-locales";
import { validateLocalPathInput } from "@/components/voies-locales/validation";

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

  const validation = validateLocalPathInput(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 422 });
  }

  const created = await createLocalPath(session.communeInsee, validation.data);
  return NextResponse.json(created, { status: 201 });
}
