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

interface InseeSiretResponse {
  etablissement?: {
    siren?: string;
    siret?: string;
    uniteLegale?: {
      denominationUniteLegale?: string | null;
      nomUniteLegale?: string | null;
      prenomUsuelUniteLegale?: string | null;
      categorieJuridiqueUniteLegale?: string | null;
    };
    adresseEtablissement?: {
      codeCommuneEtablissement?: string | null;
    };
  };
}

function inseeSettings(): { apiUrl: string; apiKey: string } {
  const apiUrl = process.env.INSEE_API_URL;
  const apiKey = process.env.INSEE_API_KEY_INTEGRATION;
  if (!apiUrl || !apiKey) {
    throw new Error(
      "Configuration API Sirene incomplète (INSEE_API_URL, INSEE_API_KEY_INTEGRATION requis).",
    );
  }
  return { apiUrl, apiKey };
}

/**
 * Résout un SIRET vers ses métadonnées via l'API Sirene de l'INSEE
 * (https://portail-api.insee.fr, endpoint /siret/{siret}).
 * Lève NotACommuneError si l'organisation n'est pas une commune (catégorie 7210).
 */
export async function resolveCommuneFromSiret(
  siret: string,
): Promise<CommuneInfo> {
  const normalized = siret.replace(/\s+/g, "");
  const { apiUrl, apiKey } = inseeSettings();

  const res = await fetch(`${apiUrl}/siret/${normalized}`, {
    headers: {
      "X-INSEE-Api-Key-Integration": apiKey,
      Accept: "application/json",
    },
  });
  if (res.status === 404) {
    throw new NotACommuneError("SIRET introuvable dans le répertoire Sirene.");
  }
  if (!res.ok) {
    throw new Error(`Recherche SIRET échouée (${res.status}).`);
  }
  const data = (await res.json()) as InseeSiretResponse;
  const etablissement = data.etablissement;
  const uniteLegale = etablissement?.uniteLegale;
  if (!etablissement || !uniteLegale) {
    throw new NotACommuneError("SIRET introuvable dans le répertoire Sirene.");
  }

  const natureJuridique = uniteLegale.categorieJuridiqueUniteLegale ?? "";
  if (natureJuridique !== COMMUNE_LEGAL_CATEGORY) {
    throw new NotACommuneError(
      `L'organisation rattachée à ce SIRET n'est pas une commune (catégorie juridique ${natureJuridique || "inconnue"}, attendu ${COMMUNE_LEGAL_CATEGORY}).`,
    );
  }

  const codeInsee =
    etablissement.adresseEtablissement?.codeCommuneEtablissement;
  if (!codeInsee) {
    throw new NotACommuneError("Code INSEE de la commune introuvable.");
  }

  const nom =
    uniteLegale.denominationUniteLegale ||
    (uniteLegale.nomUniteLegale
      ? `${uniteLegale.prenomUsuelUniteLegale ?? ""} ${uniteLegale.nomUniteLegale}`.trim()
      : null) ||
    "Commune";

  return {
    siret: etablissement.siret ?? normalized,
    siren: etablissement.siren ?? normalized.slice(0, 9),
    codeInsee,
    nom,
    natureJuridique,
  };
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

  const res = await fetch(url, { headers: { Accept: "application/json" } });
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
