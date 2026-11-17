import { after, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getCachedBdTopoPreviewJob } from "@/lib/db/bd-topo-preview-cache";
import {
  createBdTopoImportJob,
  getPendingBdTopoPreviewJob,
  runBdTopoPreviewJob,
  runBdTopoImportJob,
} from "@/lib/db/bd-topo-import-jobs";
import {
  DEFAULT_IMPORT_ALGORITHM,
  isImportAlgorithm,
} from "@/components/voies-locales/import/algorithms";

const MAX_SELECTION = 500;

function acceptedJob(id: string): Response {
  const statusUrl = `/api/voies-locales/import/bd-topo/jobs/${id}`;
  return NextResponse.json(
    { jobId: id, statusUrl },
    {
      status: 202,
      headers: { Location: statusUrl, "Cache-Control": "no-store" },
    },
  );
}

export async function GET(request: Request): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const algorithmParam = new URL(request.url).searchParams.get("algorithm");
  if (algorithmParam !== null && !isImportAlgorithm(algorithmParam)) {
    return NextResponse.json({ error: "Algorithme inconnu." }, { status: 400 });
  }
  const algorithm = algorithmParam ?? DEFAULT_IMPORT_ALGORITHM;

  const cached = await getCachedBdTopoPreviewJob(
    session.communeInsee,
    algorithm,
  );
  if (cached) return acceptedJob(cached.id);
  const pending = await getPendingBdTopoPreviewJob(
    session.communeInsee,
    algorithm,
  );
  if (pending) return acceptedJob(pending.id);
  const job = await createBdTopoImportJob(
    session.communeInsee,
    "preview",
    algorithm,
  );
  if (!job) {
    const concurrent = await getPendingBdTopoPreviewJob(
      session.communeInsee,
      algorithm,
    );
    if (concurrent) return acceptedJob(concurrent.id);
    return NextResponse.json(
      { error: "La reconstitution est momentanément indisponible. Réessayez." },
      { status: 503 },
    );
  }
  after(() => runBdTopoPreviewJob(job.id, session.communeInsee, algorithm));
  return acceptedJob(job.id);
}

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

  const keys = (body as { keys?: unknown } | null)?.keys;
  if (
    !Array.isArray(keys) ||
    keys.length === 0 ||
    keys.length > MAX_SELECTION ||
    !keys.every(
      (k): k is string =>
        typeof k === "string" && k.length > 0 && k.length <= 200,
    )
  ) {
    return NextResponse.json(
      { error: "Sélection invalide (clés de chemins attendues)." },
      { status: 422 },
    );
  }

  const algorithmValue = (body as { algorithm?: unknown } | null)?.algorithm;
  if (algorithmValue !== undefined && !isImportAlgorithm(algorithmValue)) {
    return NextResponse.json({ error: "Algorithme inconnu." }, { status: 422 });
  }
  const algorithm = algorithmValue ?? DEFAULT_IMPORT_ALGORITHM;

  const job = await createBdTopoImportJob(
    session.communeInsee,
    "import",
    algorithm,
  );
  if (!job) {
    return NextResponse.json(
      { error: "Un import est déjà en cours pour cette commune." },
      { status: 409 },
    );
  }
  after(() =>
    runBdTopoImportJob(job.id, session.communeInsee, keys, algorithm),
  );
  return acceptedJob(job.id);
}
