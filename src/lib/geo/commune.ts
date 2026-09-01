import type { Feature, Polygon, MultiPolygon } from "geojson";

/**
 * Catégories juridiques INSEE représentant une commune / mairie.
 * - 7210 : Commune et commune nouvelle
 * - 7220 : Département
 * - 7229 : (autre collectivité territoriale)
 * On accepte ici uniquement 7210 (mairie).
 */
const COMMUNE_LEGAL_CATEGORY = "7210";

export interface CommuneInfo {
  siret: string;
  siren: string;
  codeInsee: string;
  nom: string;
  natureJuridique: string;
}

export class NotACommuneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotACommuneError";
  }
}

// `fetch` (undici) ne remonte que le message générique "fetch failed" ; la
// vraie cause (DNS, TLS, connexion refusée/timeout...) est dans `err.cause`.
// On la journalise + on la répercute dans le message pour permettre un vrai
// diagnostic depuis les logs serveur (ex. Scalingo).
function describeFetchError(context: string, err: unknown): string {
  const cause =
    err instanceof Error ? (err as { cause?: unknown }).cause : undefined;
  const causeDetail =
    cause instanceof Error
      ? `${cause.name}: ${cause.message}${
          "code" in cause && (cause as NodeJS.ErrnoException).code
            ? ` (${(cause as NodeJS.ErrnoException).code})`
            : ""
        }`
      : undefined;
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[commune] ${context} a échoué:`, err);
  return causeDetail ? `${message} — cause: ${causeDetail}` : message;
}

/** Met en forme un nom de commune : "SAINT-DENIS" -> "Saint-Denis", "LA ROCHELLE" -> "La Rochelle". */
export function formatCommuneName(nom: string): string {
  return nom
    .toLocaleLowerCase("fr-FR")
    .replace(
      /(^|[\s'-])(\p{L})/gu,
      (_, sep: string, letter: string) =>
        sep + letter.toLocaleUpperCase("fr-FR"),
    );
}

interface EntrepriseSearchResult {
  results: Array<{
    siren: string;
    nom_complet?: string;
    nom_raison_sociale?: string;
    nature_juridique?: string;
    siege?: {
      siret?: string;
      commune?: string;
      libelle_commune?: string;
    };
  }>;
}

// recherche-entreprises.api.gouv.fr limite à 7 req/s par IP (30/s par ASN) et
// avertit explicitement que cette limite est probable "sur les cloud publics"
// (IP sortante mutualisée entre apps, ex. Scalingo) : dépassement -> 429, ou
// simple absence de réponse (connexion qui traîne jusqu'au timeout côté
// client) en cas de forte charge. On retente donc quelques fois avant
// d'abandonner, en respectant `Retry-After` s'il est présent.
async function fetchWithRetry(
  url: URL,
  context: string,
  attempts = 3,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      lastErr = err;
      console.error(
        `[commune] ${context} tentative ${attempt}/${attempts} a échoué:`,
        err,
      );
      if (attempt < attempts) await sleep(500 * attempt);
      continue;
    }
    if (res.status === 429 && attempt < attempts) {
      const retryAfter = Number(res.headers.get("retry-after")) || 1;
      console.error(
        `[commune] ${context} 429 (tentative ${attempt}/${attempts}), retry-after ${retryAfter}s`,
      );
      await sleep(retryAfter * 1000);
      continue;
    }
    return res;
  }
  throw new Error(
    `${context} injoignable après ${attempts} tentatives: ${describeFetchError(context, lastErr)}`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const siretCache = new Map<string, CommuneInfo>();

/**
 * Résout un SIRET vers ses métadonnées via l'API publique
 * https://recherche-entreprises.api.gouv.fr (INSEE / annuaire des entreprises).
 * Lève NotACommuneError si l'organisation n'est pas une commune (catégorie 7210).
 */
export async function resolveCommuneFromSiret(
  siret: string,
): Promise<CommuneInfo> {
  const normalized = siret.replace(/\s+/g, "");
  const cached = siretCache.get(normalized);
  if (cached) return cached;

  const url = new URL("https://recherche-entreprises.api.gouv.fr/search");
  url.searchParams.set("q", normalized);
  url.searchParams.set("per_page", "1");

  let res: Response;
  try {
    res = await fetchWithRetry(url, "recherche-entreprises.api.gouv.fr");
  } catch (err) {
    throw new Error(
      `Recherche SIRET impossible: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok) {
    throw new Error(`Recherche SIRET échouée (${res.status}).`);
  }
  const data = (await res.json()) as EntrepriseSearchResult;
  const hit = data.results?.[0];
  if (!hit) {
    throw new NotACommuneError(
      "SIRET introuvable dans le répertoire des entreprises.",
    );
  }

  const natureJuridique = hit.nature_juridique ?? "";
  if (natureJuridique !== COMMUNE_LEGAL_CATEGORY) {
    throw new NotACommuneError(
      `L'organisation rattachée à ce SIRET n'est pas une commune (catégorie juridique ${natureJuridique || "inconnue"}, attendu ${COMMUNE_LEGAL_CATEGORY}).`,
    );
  }

  const codeInsee = hit.siege?.commune;
  if (!codeInsee) {
    throw new NotACommuneError("Code INSEE de la commune introuvable.");
  }

  const info: CommuneInfo = {
    siret: hit.siege?.siret ?? normalized,
    siren: hit.siren,
    codeInsee,
    nom:
      hit.siege?.libelle_commune ??
      hit.nom_complet ??
      hit.nom_raison_sociale ??
      "Commune",
    natureJuridique,
  };
  siretCache.set(normalized, info);
  return info;
}

const contourCache = new Map<string, Feature<Polygon | MultiPolygon>>();

/**
 * Récupère le contour officiel d'une commune (IGN AdminExpress via geo.api.gouv.fr).
 */
export async function fetchCommuneContour(
  codeInsee: string,
): Promise<Feature<Polygon | MultiPolygon>> {
  const cached = contourCache.get(codeInsee);
  if (cached) return cached;

  const url = new URL(
    `https://geo.api.gouv.fr/communes/${encodeURIComponent(codeInsee)}`,
  );
  url.searchParams.set("format", "geojson");
  url.searchParams.set("geometry", "contour");

  let res: Response;
  try {
    res = await fetchWithRetry(url, "geo.api.gouv.fr");
  } catch (err) {
    throw new Error(
      `Contour de la commune indisponible: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok) {
    throw new Error(`Contour de la commune indisponible (${res.status}).`);
  }
  const feature = (await res.json()) as Feature<Polygon | MultiPolygon>;
  contourCache.set(codeInsee, feature);
  return feature;
}

export function isValidInseeCode(code: string): boolean {
  return /^(?:2[AB]\d{3}|\d{5})$/.test(code);
}
