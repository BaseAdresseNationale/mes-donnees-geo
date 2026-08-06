import { NextResponse } from "next/server";
import type { Feature, Geometry } from "geojson";
import { requireSession } from "@/lib/auth/session";
import { getPluginById } from "@/plugins/registry";
import { featureRepository } from "@/lib/repository";

interface Params {
  params: Promise<{ plugin: string; id: string }>;
}

export async function PUT(request: Request, { params }: Params): Promise<Response> {
  const { plugin: pluginId, id } = await params;
  const plugin = getPluginById(pluginId);
  if (!plugin) return NextResponse.json({ error: "Plugin inconnu" }, { status: 404 });

  try {
    const session = await requireSession();
    const body = (await request.json()) as Feature<Geometry>;

    if (!body || body.type !== "Feature" || !body.geometry) {
      return NextResponse.json({ error: "Feature GeoJSON attendu" }, { status: 400 });
    }

    const parseResult = plugin.propsSchema.safeParse(body.properties ?? {});
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation des attributs échouée", details: parseResult.error.issues },
        { status: 422 },
      );
    }

    const updated = await featureRepository.update(
      { communeInsee: session.communeInsee, pluginId },
      id,
      { ...body, properties: parseResult.data },
    );
    if (!updated) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
}

export async function DELETE(_request: Request, { params }: Params): Promise<Response> {
  const { plugin: pluginId, id } = await params;
  const plugin = getPluginById(pluginId);
  if (!plugin) return NextResponse.json({ error: "Plugin inconnu" }, { status: 404 });

  try {
    const session = await requireSession();
    const ok = await featureRepository.remove(
      { communeInsee: session.communeInsee, pluginId },
      id,
    );
    if (!ok) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
}
