import along from "@turf/along";
import bbox from "@turf/bbox";
import { lineString } from "@turf/helpers";
import turfLength from "@turf/length";
import pointToLineDistance from "@turf/point-to-line-distance";
import type { LineString } from "geojson";
import type { BdTopoTronconCandidate } from "./bd-topo";

const MATCH_BUFFER_METERS = 5;
const SAMPLE_STEP_METERS = 5;
// Marge large (imprécision bbox/degrés) pour ne jamais écarter à tort un candidat au pré-filtre.
const BBOX_MARGIN_DEGREES = 0.005;

export interface CadastralRuralPathGeometry {
  path: LineString;
  numero: number | null;
  nom: string | null;
}

export interface CadastralMatch {
  numero: number | null;
  nom: string | null;
}

function bboxesOverlap(
  a: [number, number, number, number],
  b: [number, number, number, number],
): boolean {
  return (
    a[0] - BBOX_MARGIN_DEGREES <= b[2] &&
    b[0] - BBOX_MARGIN_DEGREES <= a[2] &&
    a[1] - BBOX_MARGIN_DEGREES <= b[3] &&
    b[1] - BBOX_MARGIN_DEGREES <= a[3]
  );
}

// Les deux tracés ne coïncident jamais strictement : on vérifie qu'un tracé BD TOPO
// reste intégralement dans un couloir de `MATCH_BUFFER_METERS` autour du chemin cadastral,
// via un échantillonnage régulier (pas de dépendance polygonale/buffer réel).
function isWithinCadastralCorridor(
  bdTopoPath: LineString,
  cadastrePath: LineString,
): boolean {
  const line = lineString(bdTopoPath.coordinates);
  const cadastreLine = lineString(cadastrePath.coordinates);
  const length = turfLength(line, { units: "meters" });

  if (length === 0) {
    return (
      pointToLineDistance(line.geometry.coordinates[0], cadastreLine, {
        units: "meters",
      }) <= MATCH_BUFFER_METERS
    );
  }

  const sampleCount = Math.max(1, Math.round(length / SAMPLE_STEP_METERS));
  for (let i = 0; i <= sampleCount; i++) {
    const point = along(line, (length * i) / sampleCount, {
      units: "meters",
    });
    if (
      pointToLineDistance(point, cadastreLine, { units: "meters" }) >
      MATCH_BUFFER_METERS
    ) {
      return false;
    }
  }
  return true;
}

/** Associe chaque tronçon BD TOPO à un chemin rural cadastral dont la géométrie coïncide (tolérance 5 m). */
export function matchTronconsWithCadastre(
  candidates: BdTopoTronconCandidate[],
  cadastralRuralPaths: CadastralRuralPathGeometry[],
): Map<string, CadastralMatch> {
  const cadastralWithBbox = cadastralRuralPaths.map((cadastral) => ({
    ...cadastral,
    bbox: bbox(cadastral.path) as [number, number, number, number],
  }));

  const matches = new Map<string, CadastralMatch>();
  for (const candidate of candidates) {
    const candidateBbox = bbox(candidate.path) as [
      number,
      number,
      number,
      number,
    ];
    const match = cadastralWithBbox.find(
      (cadastral) =>
        bboxesOverlap(candidateBbox, cadastral.bbox) &&
        isWithinCadastralCorridor(candidate.path, cadastral.path),
    );
    if (match) {
      matches.set(candidate.cleabs, { numero: match.numero, nom: match.nom });
    }
  }
  return matches;
}
