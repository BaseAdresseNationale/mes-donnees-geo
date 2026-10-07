import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getBdTopoImportJob } from "@/lib/db/bd-topo-import-jobs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { jobId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
    return NextResponse.json({ error: "Tâche introuvable" }, { status: 404 });
  }
  const job = await getBdTopoImportJob(session.communeInsee, jobId);
  if (!job) {
    return NextResponse.json({ error: "Tâche introuvable" }, { status: 404 });
  }
  return NextResponse.json(job, { headers: { "Cache-Control": "no-store" } });
}