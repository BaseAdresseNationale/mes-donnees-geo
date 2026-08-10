import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/auth/session";
import {
  buildProConnectEndSessionUrl,
  proConnectConfig,
} from "@/lib/auth/proconnect";
import { resolveAppUrl } from "@/lib/http/request-url";

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  await clearSession();

  if (session?.idToken) {
    const config = await proConnectConfig();
    const endSessionUrl = buildProConnectEndSessionUrl(config, session.idToken);

    if (endSessionUrl) {
      return NextResponse.redirect(endSessionUrl, { status: 303 });
    }
  }

  return NextResponse.redirect(resolveAppUrl(request, "/"), { status: 303 });
}
