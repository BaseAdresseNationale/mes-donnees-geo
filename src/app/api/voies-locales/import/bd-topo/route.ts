import { NextResponse } from "next/server";
import turfLength from "@turf/length";
import { lineString } from "@turf/helpers";
import { requireSession } from "@/lib/auth/session";
import { BdTopoService } from "@/lib/geo/bd-topo";
import { CadastreService } from "@/lib/geo/cadastre";
import {
  assembleLocalPathsFromCadastre,
  type AssembledLocalPath,
} from "@/lib/geo/local-path-cadastre-matching";
import {
  createLocalPathsFromImport,
  getImportedSourceRefs,
  type LocalPathImportInput,
} from "@/lib/db/voies-locales";
import {
  LocalPathClassement,
  LocalPathEtat,
  LocalPathSource,
} from "@/components/voies-locales/types";
import type { AssembledLocalPathResponse } from "@/components/voies-locales/import/types";

const MAX_SELECTION = 500;

/**
 * Assemble côté serveur les chemins ruraux cadastraux à partir de la voirie BD TOPO
 * (jamais de confiance à une géométrie fournie par le client — tout est recalculé ici).
 */
async function assembleForCommune(
  codeInsee: string,
): Promise<AssembledLocalPath[]> {
  const [candidates, ruralPaths, voiesCommunales] = await Promise.all([
    BdTopoService.findTronconsForCommune(codeInsee),
    CadastreService.findRuralPathToponymsForCommune(codeInsee),
    CadastreService.findVoieCommunaleToponymsForCommune(codeInsee),
  ]);
  const cadastralPaths = [
    ...ruralPaths.map((feature) => ({
      path: feature.geometry,
      numero: feature.properties.numero,
      nom: feature.properties.nom,
      libelle: feature.properties.libelle,
      classement: LocalPathClassement.CHEMIN_RURAL,
    })),
    ...voiesCommunales.map((feature) => ({
      path: feature.geometry,
      numero: feature.properties.numero,
      nom: feature.properties.nom,
      libelle: feature.properties.libelle,
      classement: LocalPathClassement.VOIE_COMMUNALE,
    })),
  ];
  return assembleLocalPathsFromCadastre(candidates, cadastralPaths);
}

function totalLength(assembled: AssembledLocalPath): number {
  return assembled.segments.reduce(
    (sum, seg) =>
      sum + turfLength(lineString(seg.path.coordinates), { units: "meters" }),
    0,
  );
}

// Un chemin est considéré « déjà importé » si toutes ses références BD TOPO le sont.
function isAlreadyImported(
  assembled: AssembledLocalPath,
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
    getImportedSourceRefs(session.communeInsee, LocalPathSource.BD_TOPO),
  ]);

  const response: AssembledLocalPathResponse[] = assembled.map((path) => ({
    key: path.key,
    numero: path.numero,
    nom: path.nom,
    classement: path.classement,
    segments: path.segments.map((seg) => ({
      path: seg.path,
      source: seg.source,
      revetement: seg.revetement,
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
    getImportedSourceRefs(session.communeInsee, LocalPathSource.BD_TOPO),
  ]);

  const selectedKeys = new Set(keys);
  const inputs: LocalPathImportInput[] = assembled
    .filter(
      (path) =>
        selectedKeys.has(path.key) && !isAlreadyImported(path, importedRefs),
    )
    .map((path) => ({
      nom: path.nom,
      classement: path.classement,
      numero: path.numero,
      segments: path.segments.map((seg) => ({
        path: seg.path,
        type: seg.type,
        revetement: seg.revetement,
        largeurMoyenne: seg.largeurMoyenne,
        etat: LocalPathEtat.BON,
        fermeALaCirculation: null,
        servitudes: [],
        bornage: null,
        source: seg.source,
        sourceRef: seg.sourceRef,
      })),
    }));

  const created = await createLocalPathsFromImport(
    session.communeInsee,
    inputs,
  );

  return NextResponse.json(
    { created: created.length, localPaths: created },
    { status: 201 },
  );
}
