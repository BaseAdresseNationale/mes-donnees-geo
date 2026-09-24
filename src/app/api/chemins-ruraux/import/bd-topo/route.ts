import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { BdTopoService, type BdTopoTronconCandidate } from "@/lib/geo/bd-topo";
import { CadastreService } from "@/lib/geo/cadastre";
import {
  matchTronconsWithCadastre,
  type CadastralMatch,
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
import type { BdTopoCandidateResponse } from "@/components/chemins-ruraux/import/types";

// Format observé des identifiants BD TOPO (ex. "TRONROUT0000000243955677") :
// validé strictement avant réutilisation dans un CQL_FILTER (défense contre l'injection CQL).
const CLEABS_RE = /^[A-Za-z0-9]{1,64}$/;
const MAX_SELECTION = 2000;

async function matchCandidatesWithCadastre(
  codeInsee: string,
  candidates: BdTopoTronconCandidate[],
): Promise<Map<string, CadastralMatch>> {
  const cadastralRuralPaths =
    await CadastreService.findRuralPathToponymsForCommune(codeInsee);
  return matchTronconsWithCadastre(
    candidates,
    cadastralRuralPaths.map((feature) => ({
      path: feature.geometry,
      numero: feature.properties.numero,
      nom: feature.properties.nom,
    })),
  );
}

export async function GET(): Promise<Response> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const [candidates, importedRefs] = await Promise.all([
    BdTopoService.findTronconsForCommune(session.communeInsee),
    getImportedSourceRefs(session.communeInsee, RuralPathSource.BD_TOPO),
  ]);
  const cadastralMatches = await matchCandidatesWithCadastre(
    session.communeInsee,
    candidates,
  );

  const response: BdTopoCandidateResponse[] = candidates.map((c) => {
    const cadastral = cadastralMatches.get(c.cleabs);
    return {
      cleabs: c.cleabs,
      nature: c.nature,
      nomVoie: cadastral?.nom ?? c.nomVoie,
      longueur: c.longueur,
      path: c.path,
      suggestedClassement: cadastral
        ? RuralPathClassement.CHEMIN_RURAL
        : c.suggestedClassement,
      suggestedNumero: cadastral?.numero ?? null,
      suggestedSurface: c.suggestedSurface,
      suggestedLargeurMoyenne: c.suggestedLargeurMoyenne,
      suggestedDomanialite: c.suggestedDomanialite,
      alreadyImported: importedRefs.has(c.cleabs),
    };
  });

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

  const cleabs = (body as { cleabs?: unknown } | null)?.cleabs;
  if (
    !Array.isArray(cleabs) ||
    cleabs.length === 0 ||
    cleabs.length > MAX_SELECTION ||
    !cleabs.every(
      (c): c is string => typeof c === "string" && CLEABS_RE.test(c),
    )
  ) {
    return NextResponse.json(
      { error: "Sélection invalide (identifiants BD TOPO attendus)." },
      { status: 422 },
    );
  }

  const alreadyImported = await getImportedSourceRefs(
    session.communeInsee,
    RuralPathSource.BD_TOPO,
  );
  const toImport = cleabs.filter((c) => !alreadyImported.has(c));

  // Ne jamais faire confiance à la géométrie/attributs éventuellement fournis par le client :
  // on ré-interroge le WFS côté serveur à partir des seuls identifiants sélectionnés.
  const candidates = await BdTopoService.findTronconsByCleabs(toImport);
  const cadastralMatches = await matchCandidatesWithCadastre(
    session.communeInsee,
    candidates,
  );

  const inputs: RuralPathImportInput[] = candidates.map((c) => {
    const cadastral = cadastralMatches.get(c.cleabs);
    return {
      sourceRef: c.cleabs,
      nom: cadastral?.nom ?? c.nomVoie,
      classement: cadastral
        ? RuralPathClassement.CHEMIN_RURAL
        : c.suggestedClassement,
      numero: cadastral?.numero ?? null,
      segment: {
        path: c.path,
        surface: c.suggestedSurface,
        largeurMoyenne: c.suggestedLargeurMoyenne,
        etatEntretien: null,
        etatConservation: null,
        domanialite: c.suggestedDomanialite,
      },
    };
  });

  const created = await createRuralPathsFromImport(
    session.communeInsee,
    RuralPathSource.BD_TOPO,
    inputs,
  );

  return NextResponse.json(
    { created: created.length, ruralPaths: created },
    {
      status: 201,
    },
  );
}
