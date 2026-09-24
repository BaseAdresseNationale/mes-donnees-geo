import { NextResponse } from "next/server";
import turfLength from "@turf/length";
import { lineString } from "@turf/helpers";
import { requireSession } from "@/lib/auth/session";
import { BdTopoService } from "@/lib/geo/bd-topo";
import { CadastreService } from "@/lib/geo/cadastre";
import {
  assembleRuralPathsFromCadastre,
  type AssembledRuralPath,
} from "@/lib/geo/rural-path-cadastre-matching";
import {
  createRuralPathsFromImport,
  getImportedSourceRefs,
  type RuralPathImportInput,
} from "@/lib/db/chemins-ruraux";
import {
  RuralPathClassement,
  RuralPathSource,
} from "@/components/chemins-ruraux/types";
import type { AssembledRuralPathResponse } from "@/components/chemins-ruraux/import/types";

const MAX_SELECTION = 500;

/**
 * Assemble côté serveur les chemins ruraux cadastraux à partir de la voirie BD TOPO
 * (jamais de confiance à une géométrie fournie par le client — tout est recalculé ici).
 */
async function assembleForCommune(
  codeInsee: string,
): Promise<AssembledRuralPath[]> {
  const [candidates, cadastralPaths] = await Promise.all([
    BdTopoService.findTronconsForCommune(codeInsee),
    CadastreService.findRuralPathToponymsForCommune(codeInsee),
  ]);
  return assembleRuralPathsFromCadastre(
    candidates,
    cadastralPaths.map((feature) => ({
      path: feature.geometry,
      numero: feature.properties.numero,
      nom: feature.properties.nom,
      libelle: feature.properties.libelle,
    })),
  );
}

function totalLength(assembled: AssembledRuralPath): number {
  return assembled.segments.reduce(
    (sum, seg) =>
      sum + turfLength(lineString(seg.path.coordinates), { units: "meters" }),
    0,
  );
}

// Un chemin est considéré « déjà importé » si toutes ses références BD TOPO le sont.
function isAlreadyImported(
  assembled: AssembledRuralPath,
  importedRefs: Set<string>,
): boolean {
  const refs = assembled.segments
    .map((seg) => seg.sourceRef)
    .filter((ref): ref is string => ref != null);
  return refs.length > 0 && refs.every((ref) => importedRefs.has(ref));
}

export async function GET(): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const [assembled, importedRefs] = await Promise.all([
    assembleForCommune(session.communeInsee),
    getImportedSourceRefs(session.communeInsee, RuralPathSource.BD_TOPO),
  ]);

  const response: AssembledRuralPathResponse[] = assembled.map((path) => ({
    key: path.key,
    numero: path.numero,
    nom: path.nom,
    segments: path.segments.map((seg) => ({
      path: seg.path,
      source: seg.source,
      surface: seg.surface,
    })),
    longueur: totalLength(path),
    alreadyImported: isAlreadyImported(path, importedRefs),
  }));

  return NextResponse.json(response);
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

  const [assembled, importedRefs] = await Promise.all([
    assembleForCommune(session.communeInsee),
    getImportedSourceRefs(session.communeInsee, RuralPathSource.BD_TOPO),
  ]);

  const selectedKeys = new Set(keys);
  const inputs: RuralPathImportInput[] = assembled
    .filter(
      (path) =>
        selectedKeys.has(path.key) && !isAlreadyImported(path, importedRefs),
    )
    .map((path) => ({
      nom: path.nom,
      classement: RuralPathClassement.CHEMIN_RURAL,
      numero: path.numero,
      segments: path.segments.map((seg) => ({
        path: seg.path,
        surface: seg.surface,
        largeurMoyenne: seg.largeurMoyenne,
        etatEntretien: null,
        etatConservation: null,
        domanialite: seg.domanialite,
        source: seg.source,
        sourceRef: seg.sourceRef,
      })),
    }));

  const created = await createRuralPathsFromImport(
    session.communeInsee,
    inputs,
  );

  return NextResponse.json(
    { created: created.length, ruralPaths: created },
    { status: 201 },
  );
}
