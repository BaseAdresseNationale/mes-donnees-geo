import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";

export async function POST(request: Request): Promise<Response> {
  await clearSession();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
