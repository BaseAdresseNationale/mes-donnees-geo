import turfLength from "@turf/length";
import {
  CLASSEMENT_LABELS,
  DELETION_REASON_LABELS,
  DELIMITATION_LABELS,
  ETAT_LABELS,
  GESTIONNAIRE_LABELS,
  REVETEMENT_LABELS,
  SERVITUDE_LABELS,
  SOURCE_LABELS,
  TYPE_LABELS,
} from "@/components/voies-locales/types";
import type { PublishedPath } from "@/lib/publication/types";

type Position = [number, number];

// Une ligne = un segment ; les champs de la voie sont dupliqués.
export interface ExportRow {
  code_insee: string;
  numero: number;
  appellation: string | null;
  classement: string;
  date_d_affectation: string;
  gestionnaire: string | null;
  commentaire: string | null;
  type: string;
  point_ini: Position | null;
  point_fin: Position | null;
  longueur: number;
  largeur_moyenne: number | null;
  superficie: number | null;
  etat: string;
  servitudes: string[];
  delimitation: string | null;
  geometry: GeoJSON.LineString;
  revetement: string;
  geom_source: string;
}

export const CSV_COLUMNS = [
  "code_insee",
  "numero",
  "appellation",
  "classement",
  "date_d_affectation",
  "gestionnaire",
  "commentaire",
  "type",
  "point_ini",
  "point_fin",
  "longueur",
  "largeur_moyenne",
  "superficie",
  "etat",
  "servitudes",
  "delimitation",
  "geometry",
  "revetement",
  "geom_source",
] as const satisfies readonly (keyof ExportRow)[];

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildExportRows(paths: PublishedPath[]): ExportRow[] {
  const rows: ExportRow[] = [];
  for (const path of paths) {
    const segments = [...path.segments].sort((a, b) => a.ordre - b.ordre);
    const first = segments[0]?.path.coordinates[0];
    const lastCoords = segments.at(-1)?.path.coordinates;
    const last = lastCoords?.at(-1);
    const pointIni = first ? ([first[0], first[1]] as Position) : null;
    const pointFin = last ? ([last[0], last[1]] as Position) : null;

    for (const seg of segments) {
      const longueur = round2(
        turfLength(
          { type: "Feature", properties: {}, geometry: seg.path },
          {
            units: "meters",
          },
        ),
      );
      const largeur = seg.largeurMoyenne ?? null;
      rows.push({
        code_insee: path.codeInsee,
        numero: path.numero,
        appellation: path.nom ?? null,
        classement: CLASSEMENT_LABELS[path.classement],
        date_d_affectation: path.dateDAffectation,
        gestionnaire: path.gestionnaire
          ? GESTIONNAIRE_LABELS[path.gestionnaire]
          : null,
        commentaire: path.commentaire ?? null,
        type: TYPE_LABELS[seg.type],
        point_ini: pointIni,
        point_fin: pointFin,
        longueur,
        largeur_moyenne: largeur,
        superficie: largeur != null ? round2(longueur * largeur) : null,
        // Une voie supprimée est publiée avec son motif de suppression comme état.
        etat: path.deletionReason
          ? DELETION_REASON_LABELS[path.deletionReason]
          : ETAT_LABELS[seg.etat],
        servitudes: seg.servitudes.map((s) => SERVITUDE_LABELS[s]),
        delimitation: seg.delimitation
          ? DELIMITATION_LABELS[seg.delimitation]
          : null,
        geometry: seg.path,
        revetement: REVETEMENT_LABELS[seg.revetement],
        geom_source:
          seg.source === "BD_TOPO" && seg.sourceRef
            ? `${SOURCE_LABELS[seg.source]} (${seg.sourceRef})`
            : SOURCE_LABELS[seg.source],
      });
    }
  }
  return rows;
}

const wktPosition = (p: Position) => `${p[0]} ${p[1]}`;
const wktPoint = (p: Position) => `POINT(${wktPosition(p)})`;
const wktLineString = (g: GeoJSON.LineString) =>
  `LINESTRING(${g.coordinates.map((c) => wktPosition([c[0], c[1]])).join(", ")})`;

// Neutralise l'interprétation d'une cellule comme formule par un tableur.
function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function csvValue(
  row: ExportRow,
  column: (typeof CSV_COLUMNS)[number],
): string {
  switch (column) {
    case "point_ini":
    case "point_fin": {
      const p = row[column];
      return p ? wktPoint(p) : "";
    }
    case "geometry":
      return wktLineString(row.geometry);
    case "servitudes":
      return neutralizeFormula(row.servitudes.join("; "));
    default: {
      const v = row[column];
      if (v == null) return "";
      return typeof v === "string" ? neutralizeFormula(v) : String(v);
    }
  }
}

export function toCsv(rows: ExportRow[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((c) => csvCell(csvValue(row, c))).join(","));
  }
  // BOM UTF-8 pour une ouverture correcte des accents dans Excel.
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function toGeoJson(rows: ExportRow[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: rows.map(({ geometry, ...properties }) => ({
      type: "Feature",
      geometry,
      properties,
    })),
  };
}
