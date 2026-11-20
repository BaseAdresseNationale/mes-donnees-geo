import "server-only";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { CadastreService } from "@/lib/geo/cadastre";

const MAJIC_LINES_URL =
  process.env.URL_API_MAJIC ||
  "https://koumoul.com/data-fair/api/v1/datasets/parcelles-des-personnes-morales/lines";

const PAGE_SIZE = 10_000;
const REQUEST_TIMEOUT_MS = 30_000;

interface MajicLine {
  code_parcelle: string;
  denomination?: string;
  forme_juridique_abregee?: string;
  groupe_personne?: string;
}

interface MajicPage {
  next?: string;
  results: MajicLine[];
}

export interface MajicParcelleProperties {
  id: string;
  denomination: string;
  formeJuridique: string | null;
  groupePersonne: string | null;
}

async function fetchMajicLines(codeCommune: string): Promise<MajicLine[]> {
  const params = new URLSearchParams({
    size: String(PAGE_SIZE),
    code_commune_eq: codeCommune,
    select: "code_parcelle,denomination,forme_juridique_abregee,groupe_personne",
  });

  const lines: MajicLine[] = [];
  let url: string | undefined = `${MAJIC_LINES_URL}?${params}`;
  while (url) {
    const response: Response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Requête MAJIC échouée (${response.status}).`);
    }
    const page = (await response.json()) as MajicPage;
    lines.push(...page.results);
    url = page.next;
  }
  return lines;
}

// Parcelles de la commune détenues par des personnes morales : géométries du
// cadastre jointes aux données MAJIC par code parcelle.
export async function findMajicParcelles(
  codeCommune: string,
): Promise<FeatureCollection<Geometry, MajicParcelleProperties>> {
  const [lines, parcelles] = await Promise.all([
    fetchMajicLines(codeCommune),
    CadastreService.findCadastreCommune(codeCommune),
  ]);

  const linesByParcelle = new Map(
    lines.map((line) => [line.code_parcelle, line]),
  );

  const features: Feature<Geometry, MajicParcelleProperties>[] = [];
  for (const parcelle of parcelles.features) {
    const line = linesByParcelle.get(parcelle.properties.id);
    if (!line) continue;
    features.push({
      type: "Feature",
      geometry: parcelle.geometry,
      properties: {
        id: parcelle.properties.id,
        denomination: line.denomination ?? "",
        formeJuridique: line.forme_juridique_abregee ?? null,
        groupePersonne: line.groupe_personne ?? null,
      },
    });
  }

  return { type: "FeatureCollection", features };
}
