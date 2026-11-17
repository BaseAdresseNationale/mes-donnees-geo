import { NextResponse } from "next/server";
import type { FeatureCollection, LineString } from "geojson";
import { requireSession } from "@/lib/auth/session";
import { BdTopoService } from "@/lib/geo/bd-topo";

interface BdTopoTronconProperties {
  cleabs: string;
  nature: string;
  nomVoie: string | null;
}

type TronconCollection = FeatureCollection<LineString, BdTopoTronconProperties>;

// Le WFS est lent (jusqu'à plusieurs minutes pour une grosse commune) : cache mémoire de debug.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<
  string,
  { expiresAt: number; promise: Promise<TronconCollection> }
>();

async function loadTroncons(codeInsee: string): Promise<TronconCollection> {
  const candidates = await BdTopoService.findTronconsForCommune(codeInsee);
  return {
    type: "FeatureCollection",
    features: candidates.map((candidate) => ({
      type: "Feature",
      properties: {
        cleabs: candidate.cleabs,
        nature: candidate.nature,
        nomVoie: candidate.nomVoie,
      },
      geometry: candidate.path,
    })),
  };
}

function getTroncons(codeInsee: string): Promise<TronconCollection> {
  const cached = cache.get(codeInsee);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  const promise = loadTroncons(codeInsee);
  cache.set(codeInsee, { expiresAt: Date.now() + CACHE_TTL_MS, promise });
  promise.catch(() => cache.delete(codeInsee));
  return promise;
}

export async function GET(): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    return NextResponse.json(await getTroncons(session.communeInsee));
  } catch (error) {
    console.error("Erreur lors de la récupération des tronçons BD TOPO", error);
    return NextResponse.json(
      { error: "Impossible de récupérer les tronçons BD TOPO" },
      { status: 502 },
    );
  }
}
