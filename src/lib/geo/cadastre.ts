import { gunzipSync } from "zlib";
import type { Feature, FeatureCollection, Geometry, LineString } from "geojson";

interface ParcelleProperties {
  id: string;
  commune: string;
  prefixe: string;
  section: string;
  numero: string;
  contenance: number;
  arpente: boolean;
  created: string;
  updated: string;
}

type ParcellesCollection = FeatureCollection<Geometry, ParcelleProperties>;

interface ZonCommuniFeature {
  type: "Feature";
  id: string;
  properties: Record<string, string>;
  geometry: LineString;
  extraProperties?: { labels?: { parts?: string[] } };
}

interface ZonCommuniCollection {
  type: "FeatureCollection";
  features: ZonCommuniFeature[];
}

export interface CadastralRuralPathProperties {
  /** Libellé brut tel qu'affiché sur le plan (ex. "Chemin rural n° 108 dit de la Barosserie"). */
  libelle: string;
  numero: number | null;
  /** Partie nominale seule (ex. "de la Barosserie"), sans "Chemin rural n°X dit". */
  nom: string | null;
}

// "Chemin rural" est un statut juridique, pas un type de voie unique : on ne
// retient que les libellés qui contiennent littéralement ces deux mots.
const RURAL_PATH_LABEL_WORDS = ["chemin", "rural"];

function isRuralPathLabel(parts: string[] | undefined): boolean {
  if (!parts) return false;
  const lowerParts = parts.map((part) => part.toLowerCase());
  return RURAL_PATH_LABEL_WORDS.every((word) => lowerParts.includes(word));
}

// Certaines communes fournissent le libellé à l'envers (ex. finit par "Chemin" au lieu
// de commencer par lui) : on remet le tableau dans le bon sens avant de le parser.
function normalizePartsOrder(parts: string[]): string[] {
  if (parts.length === 0) return parts;
  const isCheminWord = (word: string) => /^(chemin|rural)$/i.test(word);
  const startsWithChemin = isCheminWord(
    parts[0].split(/\s+/).filter(Boolean)[0] ?? "",
  );
  const lastWords = parts[parts.length - 1].split(/\s+/).filter(Boolean);
  const endsWithChemin = isCheminWord(lastWords[lastWords.length - 1] ?? "");
  return !startsWithChemin && endsWithChemin ? [...parts].reverse() : parts;
}

const RURAL_PATH_NUMERO_PATTERN = /^n[°o]\.?(\d+)$/i;

// Un nom réduit à un complément ("de la Barosserie") se lit mieux préfixé de "Chemin".
function prefixCheminIfLiaison(nom: string): string {
  return /^(de|des|du)\b/i.test(nom) || /^d['’]/i.test(nom)
    ? `Chemin ${nom}`
    : nom;
}

// Un libellé cadastral "chemin rural" suit le patron "Chemin rural [n°X] [dit] [nom]"
// (chaque mot pouvant être glué ou séparé selon les communes, cf. rural-paths.md).
function parseRuralPathLabel(parts: string[]): {
  numero: number | null;
  nom: string | null;
} {
  const words = parts.flatMap((part) => part.split(/\s+/)).filter(Boolean);
  let i = 0;
  while (i < words.length && /^(chemin|rural)$/i.test(words[i])) i++;

  let numero: number | null = null;
  if (i < words.length) {
    const glued = RURAL_PATH_NUMERO_PATTERN.exec(words[i]);
    if (glued) {
      numero = Number(glued[1]);
      i++;
    } else if (
      /^n[°o]\.?$/i.test(words[i]) &&
      /^\d+$/.test(words[i + 1] ?? "")
    ) {
      numero = Number(words[i + 1]);
      i += 2;
    }
  }

  if (i < words.length && /^dit$/i.test(words[i])) i++;

  const rest = words.slice(i).join(" ").trim();
  // Un "reste" qui recontient "chemin rural" trahit un libellé dupliqué/mal formé (vu en pratique).
  const nom =
    rest && !/chemin.*rural/i.test(rest) ? prefixCheminIfLiaison(rest) : null;

  return { numero, nom };
}

// Détection des voies communales (1re version simple : libellé contenant "voie" ET
// "communale" ; à affiner avec une RegExp plus fine ensuite).
const VOIE_COMMUNALE_LABEL_WORDS = ["voie", "communale"];

function isVoieCommunaleLabel(parts: string[] | undefined): boolean {
  if (!parts) return false;
  const lowerParts = parts.map((part) => part.toLowerCase());
  return VOIE_COMMUNALE_LABEL_WORDS.every((word) => lowerParts.includes(word));
}

function normalizeVoieCommunalePartsOrder(parts: string[]): string[] {
  if (parts.length === 0) return parts;
  const isLeadWord = (word: string) => /^(voie|communale)$/i.test(word);
  const startsWithLead = isLeadWord(
    parts[0].split(/\s+/).filter(Boolean)[0] ?? "",
  );
  const lastWords = parts[parts.length - 1].split(/\s+/).filter(Boolean);
  const endsWithLead = isLeadWord(lastWords[lastWords.length - 1] ?? "");
  return !startsWithLead && endsWithLead ? [...parts].reverse() : parts;
}

function prefixVoieIfLiaison(nom: string): string {
  return /^(de|des|du)\b/i.test(nom) || /^d['’]/i.test(nom)
    ? `Voie ${nom}`
    : nom;
}

function parseVoieCommunaleLabel(parts: string[]): {
  numero: number | null;
  nom: string | null;
} {
  const words = parts.flatMap((part) => part.split(/\s+/)).filter(Boolean);
  let i = 0;
  while (i < words.length && /^(voie|communale)$/i.test(words[i])) i++;

  let numero: number | null = null;
  if (i < words.length) {
    const glued = RURAL_PATH_NUMERO_PATTERN.exec(words[i]);
    if (glued) {
      numero = Number(glued[1]);
      i++;
    } else if (
      /^n[°o]\.?$/i.test(words[i]) &&
      /^\d+$/.test(words[i + 1] ?? "")
    ) {
      numero = Number(words[i + 1]);
      i += 2;
    }
  }

  if (i < words.length && /^dit$/i.test(words[i])) i++;

  const rest = words.slice(i).join(" ").trim();
  const nom =
    rest && !/voie.*communale/i.test(rest) ? prefixVoieIfLiaison(rest) : null;

  return { numero, nom };
}

// Codes commune DOM (971-978, 986-988) sur 3 chiffres, sinon 2 (dont Corse "2A"/"2B").
function departementCodeFromCommune(codeCommune: string): string {
  return /^9[78]/.test(codeCommune)
    ? codeCommune.slice(0, 3)
    : codeCommune.slice(0, 2);
}

const URL_API_CADASTRE: string =
  process.env.URL_API_CADASTRE || "https://cadastre.data.gouv.fr/bundler/";

const URL_CADASTRE_RAW: string =
  process.env.URL_CADASTRE_RAW ||
  "https://files.data.gouv.fr/cadastre/etalab-cadastre";

const CADASTRE_RAW_MILLESIME: string =
  process.env.CADASTRE_RAW_MILLESIME || "2026-06-01";

export class CadastreService {
  private static async request(url: string): Promise<any> {
    const res = await fetch(`${URL_API_CADASTRE}${url}`);

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message);
    }

    return res.json();
  }

  public static findCadastreCommune(
    codeCommune: string,
  ): Promise<ParcellesCollection> {
    return this.request(
      `/cadastre-etalab/communes/${codeCommune}/geojson/parcelles`,
    );
  }

  // "Zone de communication" (EDIGEO) : habillage du plan portant les libellés
  // de voies/chemins, absent de l'API bundler (parcelles/sections/bâtiments only).
  private static async fetchZonCommuni(
    codeCommune: string,
  ): Promise<ZonCommuniCollection> {
    const codeDepartement = departementCodeFromCommune(codeCommune);
    const url =
      `${URL_CADASTRE_RAW}/${CADASTRE_RAW_MILLESIME}/geojson/communes/` +
      `${codeDepartement}/${codeCommune}/raw/pci-${codeCommune}-zoncommuni.json.gz`;

    const res = await fetch(url);
    if (res.status === 404) {
      return { type: "FeatureCollection", features: [] };
    }
    if (!res.ok) {
      throw new Error(`Requête cadastre (zoncommuni) échouée (${res.status}).`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    return JSON.parse(gunzipSync(buffer).toString("utf-8"));
  }

  /** Habillage cadastral (zoncommuni) dont le libellé désigne un chemin rural. */
  public static async findRuralPathToponymsForCommune(
    codeCommune: string,
  ): Promise<Feature<LineString, CadastralRuralPathProperties>[]> {
    const { features } = await this.fetchZonCommuni(codeCommune);
    return features
      .filter((feature) =>
        isRuralPathLabel(feature.extraProperties?.labels?.parts),
      )
      .map((feature) => {
        const parts = normalizePartsOrder(
          feature.extraProperties!.labels!.parts!,
        );
        const { numero, nom } = parseRuralPathLabel(parts);
        return {
          type: "Feature",
          id: feature.id,
          properties: { libelle: parts.join(" "), numero, nom },
          geometry: feature.geometry,
        };
      });
  }

  /** Habillage cadastral (zoncommuni) dont le libellé désigne une voie communale. */
  public static async findVoieCommunaleToponymsForCommune(
    codeCommune: string,
  ): Promise<Feature<LineString, CadastralRuralPathProperties>[]> {
    const { features } = await this.fetchZonCommuni(codeCommune);
    return features
      .filter((feature) =>
        isVoieCommunaleLabel(feature.extraProperties?.labels?.parts),
      )
      .map((feature) => {
        const parts = normalizeVoieCommunalePartsOrder(
          feature.extraProperties!.labels!.parts!,
        );
        const { numero, nom } = parseVoieCommunaleLabel(parts);
        return {
          type: "Feature",
          id: feature.id,
          properties: { libelle: parts.join(" "), numero, nom },
          geometry: feature.geometry,
        };
      });
  }
}
