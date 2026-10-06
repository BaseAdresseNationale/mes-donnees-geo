import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { forwardToMesAdressesApi } from "@/lib/api-bal/proxy";

interface RouteParams {
  params: Promise<{ balId: string; path: string[] }>;
}

// Identifiant de BAL au format ObjectId (24 caractères hexadécimaux)
const BAL_ID_RE = /^[0-9a-f]{24}$/i;

// Proxy vers mes-adresses-api : /api/adresses/bal/{balId}/v2/... -> {API}/v2/...
async function handler(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { balId, path } = await params;
  if (!BAL_ID_RE.test(balId)) {
    return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  }

  return forwardToMesAdressesApi({ request, session, balId, path });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
