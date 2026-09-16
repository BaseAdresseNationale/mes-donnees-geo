import type { LineString } from "geojson";
import turfLength from "@turf/length";
import { lineString } from "@turf/helpers";
import {
  RuralPathClassement,
  RuralPathDomanialite,
  RuralPathSurface,
} from "@/generated/prisma/browser";

const URL_API_BD_TOPO_WFS: string =
  process.env.URL_API_BD_TOPO_WFS || "https://data.geopf.fr/wfs/ows";

// Nature BD TOPO -> valeurs par défaut de qualification (l'utilisateur les corrige ensuite).
const NATURE_CLASSEMENT: Record<string, RuralPathClassement> = {
  Chemin: RuralPathClassement.CHEMIN_RURAL,
  Sentier: RuralPathClassement.CHEMIN_RURAL,
};
const NATURE_SURFACE: Record<string, RuralPathSurface> = {
  Chemin: RuralPathSurface.EARTH,
  Sentier: RuralPathSurface.EARTH,
  "Route empierrée": RuralPathSurface.STONED,
};

export interface BdTopoTronconCandidate {
  cleabs: string;
  nature: string;
  nomVoie: string | null;
  longueur: number;
  path: LineString;
  suggestedClassement: RuralPathClassement;
  suggestedSurface: RuralPathSurface;
  suggestedLargeurMoyenne: number | null;
  suggestedDomanialite: RuralPathDomanialite | null;
}

interface WfsProperties {
  cleabs?: string;
  nature?: string;
  nom_voie_ban_gauche?: string;
  nom_voie_ban_droite?: string;
  nom_collaboratif_gauche?: string;
  nom_collaboratif_droite?: string;
  largeur_de_chaussee?: number;
  prive?: boolean;
}

interface WfsGeometry {
  type: string;
  coordinates: [number, number, number?][];
}

interface WfsFeatureCollection {
  features: { properties: WfsProperties; geometry: WfsGeometry }[];
}

function firstNonEmpty(...values: (string | undefined)[]): string | null {
  for (const v of values) {
    if (v && v.trim().length > 0) return v.trim();
  }
  return null;
}

function toCandidate(
  properties: WfsProperties,
  geometry: WfsGeometry,
): BdTopoTronconCandidate | null {
  if (!properties.cleabs || geometry.type !== "LineString") return null;

  // BD TOPO renvoie des coordonnées 3D (avec altitude) ; nos tracés sont en 2D (WGS84 lng/lat).
  const coordinates: [number, number][] = geometry.coordinates.map(
    ([lng, lat]) => [lng, lat],
  );
  if (coordinates.length < 2) return null;

  const path: LineString = { type: "LineString", coordinates };
  const nature = properties.nature ?? "";

  return {
    cleabs: properties.cleabs,
    nature,
    nomVoie: firstNonEmpty(
      properties.nom_voie_ban_gauche,
      properties.nom_voie_ban_droite,
      properties.nom_collaboratif_gauche,
      properties.nom_collaboratif_droite,
    ),
    longueur: turfLength(lineString(coordinates), { units: "meters" }),
    path,
    suggestedClassement:
      NATURE_CLASSEMENT[nature] ?? RuralPathClassement.VOIE_COMMUNALE,
    suggestedSurface: NATURE_SURFACE[nature] ?? RuralPathSurface.PAVED,
    suggestedLargeurMoyenne:
      typeof properties.largeur_de_chaussee === "number"
        ? Math.round(properties.largeur_de_chaussee)
        : null,
    suggestedDomanialite:
      typeof properties.prive === "boolean"
        ? properties.prive
          ? RuralPathDomanialite.PRIVE
          : RuralPathDomanialite.PUBLIC
        : null,
  };
}

async function requestGetFeature(
  cqlFilter: string,
): Promise<BdTopoTronconCandidate[]> {
  const url = new URL(URL_API_BD_TOPO_WFS);
  url.searchParams.set("SERVICE", "WFS");
  url.searchParams.set("VERSION", "2.0.0");
  url.searchParams.set("REQUEST", "GetFeature");
  url.searchParams.set("TYPENAMES", "BDTOPO_V3:troncon_de_route");
  url.searchParams.set("OUTPUTFORMAT", "application/json");
  url.searchParams.set("SRSNAME", "EPSG:4326");
  url.searchParams.set("COUNT", "5000");
  url.searchParams.set("CQL_FILTER", cqlFilter);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Requête BD TOPO (WFS) échouée (${res.status}).`);
  }
  const data = (await res.json()) as WfsFeatureCollection;
  const candidates: BdTopoTronconCandidate[] = [];
  for (const feature of data.features) {
    const candidate = toCandidate(feature.properties, feature.geometry);
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

export class BdTopoService {
  /**
   * Tronçons de route BD TOPO dont la commune (côté gauche ou droit) est `codeInsee`.
   * `insee_commune_gauche`/`insee_commune_droite` sont les seuls attributs de filtrage
   * disponibles sur ce featureType (pas d'INTERSECTS nécessaire).
   */
  public static findTronconsForCommune(
    codeInsee: string,
  ): Promise<BdTopoTronconCandidate[]> {
    const escaped = codeInsee.replace(/'/g, "''");
    return requestGetFeature(
      `insee_commune_gauche='${escaped}' OR insee_commune_droite='${escaped}'`,
    );
  }

  /** Ré-interroge le WFS par cleabs (jamais le géométrie/attributs fournis par le client). */
  public static findTronconsByCleabs(
    cleabsList: string[],
  ): Promise<BdTopoTronconCandidate[]> {
    if (cleabsList.length === 0) return Promise.resolve([]);
    const list = cleabsList.map((c) => `'${c.replace(/'/g, "''")}'`).join(",");
    return requestGetFeature(`cleabs IN (${list})`);
  }
}
