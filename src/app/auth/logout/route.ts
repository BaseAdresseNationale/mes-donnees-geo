import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/auth/session";
import {
  buildProConnectEndSessionUrl,
  proConnectConfig,
} from "@/lib/auth/proconnect";

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

  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
