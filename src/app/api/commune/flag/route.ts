import { getCommuneFlag } from "@/lib/api/blason-commune";
import { requireSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await requireSession();
  const flagUrl = await getCommuneFlag(session.communeInsee);

  return NextResponse.json(flagUrl);
}
