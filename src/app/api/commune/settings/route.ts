import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import {
  getCommuneSettings,
  upsertCommuneSettings,
} from "@/lib/db/commune-settings";
import { listAllPlugins } from "@/plugins/registry";

export async function GET(): Promise<Response> {
  try {
    const session = await requireSession();
    const settings = await getCommuneSettings(session.communeInsee);
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
}

interface UpdatePayload {
  disabledPlugins?: unknown;
}

export async function PUT(request: Request): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: UpdatePayload;
  try {
    body = (await request.json()) as UpdatePayload;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const knownIds = new Set(listAllPlugins().map((p) => p.id));
  let disabledPlugins: string[] | undefined;
  if (body.disabledPlugins !== undefined) {
    if (
      !Array.isArray(body.disabledPlugins) ||
      !body.disabledPlugins.every(
        (id): id is string => typeof id === "string" && knownIds.has(id),
      )
    ) {
      return NextResponse.json(
        {
          error:
            "disabledPlugins doit contenir des identifiants de plugins connus.",
        },
        { status: 422 },
      );
    }
    disabledPlugins = Array.from(new Set(body.disabledPlugins));
  }

  const updated = await upsertCommuneSettings(session.communeInsee, {
    disabledPlugins,
  });
  return NextResponse.json(updated);
}
