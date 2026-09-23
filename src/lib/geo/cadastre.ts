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
  nom: string;
}

// "Chemin rural" est un statut juridique, pas un type de voie unique : on ne
// retient que les libellés qui contiennent littéralement ces deux mots.
const RURAL_PATH_LABEL_WORDS = ["chemin", "rural"];

function isRuralPathLabel(parts: string[] | undefined): boolean {
  if (!parts) return false;
  const lowerParts = parts.map((part) => part.toLowerCase());
  return RURAL_PATH_LABEL_WORDS.every((word) => lowerParts.includes(word));
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
      .map((feature) => ({
        type: "Feature",
        id: feature.id,
        properties: {
          nom: feature.extraProperties!.labels!.parts!.join(" "),
        },
        geometry: feature.geometry,
      }));
  }
}
