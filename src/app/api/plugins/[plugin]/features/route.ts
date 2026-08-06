import { NextResponse } from "next/server";
import type { Feature, Geometry } from "geojson";
import { requireSession } from "@/lib/auth/session";
import { getPluginById } from "@/plugins/registry";
import { featureRepository } from "@/lib/repository";

interface Params {
  params: Promise<{ plugin: string }>;
}

export async function GET(_request: Request, { params }: Params): Promise<Response> {
  const { plugin: pluginId } = await params;
  const plugin = getPluginById(pluginId);
  if (!plugin) return NextResponse.json({ error: "Plugin inconnu" }, { status: 404 });

  try {
    const session = await requireSession();
    const fc = await plugin.loadFeatures({ communeInsee: session.communeInsee });
    return NextResponse.json(fc);
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
}

export async function POST(request: Request, { params }: Params): Promise<Response> {
  const { plugin: pluginId } = await params;
  const plugin = getPluginById(pluginId);
  if (!plugin) return NextResponse.json({ error: "Plugin inconnu" }, { status: 404 });

  try {
    const session = await requireSession();
    const body = (await request.json()) as Feature<Geometry>;

    if (!body || body.type !== "Feature" || !body.geometry) {
      return NextResponse.json({ error: "Feature GeoJSON attendu" }, { status: 400 });
    }
    if (!plugin.geometryTypes.includes(body.geometry.type as never)) {
      return NextResponse.json(
        { error: `Géométrie ${body.geometry.type} non supportée par ce plugin.` },
        { status: 400 },
      );
    }

    const merged: Feature<Geometry> = {
      ...body,
      properties: {
        ...plugin.defaultProps,
        ...(body.properties ?? {}),
      },
    };

    const parseResult = plugin.propsSchema.safeParse(merged.properties);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation des attributs échouée", details: parseResult.error.issues },
        { status: 422 },
      );
    }

    const saved = await featureRepository.create(
      { communeInsee: session.communeInsee, pluginId },
      { ...merged, properties: parseResult.data },
    );
    return NextResponse.json(saved, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
}
