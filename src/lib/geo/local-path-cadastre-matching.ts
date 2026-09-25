import along from "@turf/along";
import bbox from "@turf/bbox";
import { lineString } from "@turf/helpers";
import turfLength from "@turf/length";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import type { LineString, Position } from "geojson";
import {
  LocalPathClassement,
  LocalPathRevetement,
  LocalPathSource,
  LocalPathType,
} from "@/generated/prisma/browser";
import type { BdTopoTronconCandidate } from "./bd-topo";

// Couloir de tolérance entre un tronçon BD TOPO et le tracé cadastral de référence.
const MATCH_BUFFER_METERS = 5;
const SAMPLE_STEP_METERS = 5;
// Marge large (imprécision bbox/degrés) pour ne jamais écarter à tort un candidat au pré-filtre.
const BBOX_MARGIN_DEGREES = 0.005;
// En-deçà de ce seuil, le trou entre deux portions est ignoré (l'éditeur tolère ~2 m).
const GAP_FILL_MIN_METERS = 2;
// Longueur max d'un raccordement en ligne droite ; au-delà, on scinde en 2 chemins distincts.
const MAX_FILLER_METERS = 20;
// Écart d'orientation max (mod 180°) entre un tronçon et le tracé cadastral local :
// au-delà, le tronçon est jugé transversal (intersection/amorce) et écarté.
const MAX_BEARING_DIFF_DEGREES = 45;
// Dédoublonnage : une portion dont ≥ DEDUP_COVER_RATIO des points sont à ≤ DEDUP_TOL_METERS
// d'une portion plus longue déjà retenue est jugée redondante (doublon/superposition BD TOPO).
const DEDUP_TOL_METERS = 5;
const DEDUP_COVER_RATIO = 0.7;

export interface CadastralRuralPathGeometry {
  path: LineString;
  numero: number | null;
  nom: string | null;
  libelle: string;
  classement: LocalPathClassement;
}

export interface AssembledSegment {
  path: LineString;
  source: LocalPathSource;
  sourceRef: string | null;
  type: LocalPathType;
  revetement: LocalPathRevetement;
  largeurMoyenne: number | null;
}

export interface AssembledLocalPath {
  /** Clé de regroupement stable (numéro cadastral, sinon nom, sinon index de feature). */
  key: string;
  numero: number | null;
  nom: string | null;
  classement: LocalPathClassement;
  segments: AssembledSegment[];
}

type Bbox = [number, number, number, number];

interface CadastralGroup {
  key: string;
  numero: number | null;
  nom: string | null;
  classement: LocalPathClassement;
  lines: LineString[];
  bbox: Bbox;
}

interface Portion {
  path: LineString;
  candidate: BdTopoTronconCandidate;
}

function haversineMeters(a: Position, b: Position): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function bboxesOverlap(a: Bbox, b: Bbox): boolean {
  return (
    a[0] - BBOX_MARGIN_DEGREES <= b[2] &&
    b[0] - BBOX_MARGIN_DEGREES <= a[2] &&
    a[1] - BBOX_MARGIN_DEGREES <= b[3] &&
    b[1] - BBOX_MARGIN_DEGREES <= a[3]
  );
}

function mergeBbox(a: Bbox, b: Bbox): Bbox {
  return [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[2], b[2]),
    Math.max(a[3], b[3]),
  ];
}

function initialBearing(a: Position, b: Position): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const dLng = toRad(b[0] - a[0]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Écart angulaire entre deux caps, insensible au sens de parcours (0..90°).
function bearingDifference(b1: number, b2: number): number {
  let d = Math.abs(b1 - b2) % 360;
  if (d > 180) d = 360 - d;
  if (d > 90) d = 180 - d;
  return d;
}

interface NearestCadastral {
  distance: number;
  bearing: number | null;
}

// Point le plus proche sur l'ensemble des lignes cadastrales du groupe : distance (m)
// + cap local du segment cadastral concerné (pour le test d'orientation).
function nearestCadastral(
  coord: Position,
  lines: LineString[],
): NearestCadastral {
  let best: NearestCadastral = { distance: Infinity, bearing: null };
  for (const line of lines) {
    const coords = line.coordinates;
    if (coords.length < 2) continue;
    const snapped = nearestPointOnLine(lineString(coords), coord, {
      units: "meters",
    });
    const distance = snapped.properties.dist ?? Infinity;
    if (distance < best.distance) {
      const index = Math.min(snapped.properties.index ?? 0, coords.length - 2);
      best = {
        distance,
        bearing: initialBearing(coords[index], coords[index + 1]),
      };
    }
  }
  return best;
}

// Regroupe les chemins ruraux cadastraux par identité : numéro + libellé (le numéro
// seul fusionnait des chemins distincts). Fallback sur l'index de feature si pas de libellé.
function groupCadastralPaths(
  cadastralPaths: CadastralRuralPathGeometry[],
): CadastralGroup[] {
  const groups = new Map<string, CadastralGroup>();
  cadastralPaths.forEach((cadastral, index) => {
    const label = cadastral.libelle.trim().toLocaleLowerCase();
    const key = label
      ? `${cadastral.classement}|${cadastral.numero ?? ""}|${label}`
      : `feat:${index}`;
    const lineBbox = bbox(cadastral.path) as Bbox;
    const existing = groups.get(key);
    if (existing) {
      existing.lines.push(cadastral.path);
      existing.bbox = mergeBbox(existing.bbox, lineBbox);
      existing.numero ??= cadastral.numero;
      existing.nom ??= cadastral.nom;
    } else {
      groups.set(key, {
        key,
        numero: cadastral.numero,
        nom: cadastral.nom,
        classement: cadastral.classement,
        lines: [cadastral.path],
        bbox: lineBbox,
      });
    }
  });
  return [...groups.values()];
}

// Extrait la ou les portions d'un tronçon BD TOPO qui restent dans le couloir cadastral.
// Si tout le tronçon matche, on renvoie sa géométrie d'origine (sans rééchantillonnage).
function corridorPortions(
  tronconPath: LineString,
  cadastralLines: LineString[],
): LineString[] {
  if (tronconPath.coordinates.length < 2) return [];
  const line = lineString(tronconPath.coordinates);
  const length = turfLength(line, { units: "meters" });
  if (length === 0) return [];

  const sampleCount = Math.max(1, Math.round(length / SAMPLE_STEP_METERS));
  const samples: Position[] = [];
  for (let i = 0; i <= sampleCount; i++) {
    samples.push(
      along(line, (length * i) / sampleCount, { units: "meters" }).geometry
        .coordinates as Position,
    );
  }

  // Un point compte comme « dans le couloir » s'il est à ≤5 m ET orienté comme le
  // tracé cadastral local (écarte les tronçons transversaux aux intersections).
  const inside: boolean[] = samples.map((coord, i) => {
    const info = nearestCadastral(coord, cadastralLines);
    if (info.distance > MATCH_BUFFER_METERS || info.bearing === null) {
      return false;
    }
    const j = i < samples.length - 1 ? i : i - 1;
    const tronconBearing = initialBearing(samples[j], samples[j + 1]);
    return (
      bearingDifference(tronconBearing, info.bearing) <=
      MAX_BEARING_DIFF_DEGREES
    );
  });

  if (inside.every(Boolean)) return [tronconPath];

  const portions: LineString[] = [];
  let run: Position[] = [];
  for (let i = 0; i < samples.length; i++) {
    if (inside[i]) {
      run.push(samples[i]);
    } else if (run.length >= 2) {
      portions.push({ type: "LineString", coordinates: run });
      run = [];
    } else {
      run = [];
    }
  }
  if (run.length >= 2) portions.push({ type: "LineString", coordinates: run });
  return portions;
}

function start(path: LineString): Position {
  return path.coordinates[0];
}

function end(path: LineString): Position {
  return path.coordinates[path.coordinates.length - 1];
}

function reversePortion(portion: Portion): Portion {
  return {
    ...portion,
    path: {
      type: "LineString",
      coordinates: [...portion.path.coordinates].reverse(),
    },
  };
}

// Ordonne les portions en une chaîne, en rattachant à chaque étape la portion la
// plus proche de l'une des deux extrémités courantes (avec inversion si besoin).
function chainPortions(portions: Portion[]): Portion[] {
  if (portions.length <= 1) return portions;
  const remaining = portions.slice();
  const chain: Portion[] = [remaining.shift()!];

  let progress = true;
  while (remaining.length > 0 && progress) {
    progress = false;
    const headStart = start(chain[0].path);
    const tailEnd = end(chain[chain.length - 1].path);

    let best: {
      idx: number;
      dist: number;
      where: "head" | "tail";
      flip: boolean;
    } | null = null;
    remaining.forEach((portion, idx) => {
      const s = start(portion.path);
      const e = end(portion.path);
      const options: { dist: number; where: "head" | "tail"; flip: boolean }[] =
        [
          { dist: haversineMeters(tailEnd, s), where: "tail", flip: false },
          { dist: haversineMeters(tailEnd, e), where: "tail", flip: true },
          { dist: haversineMeters(headStart, e), where: "head", flip: false },
          { dist: haversineMeters(headStart, s), where: "head", flip: true },
        ];
      for (const option of options) {
        if (!best || option.dist < best.dist) {
          best = { idx, ...option };
        }
      }
    });

    if (best) {
      const chosen = best as {
        idx: number;
        dist: number;
        where: "head" | "tail";
        flip: boolean;
      };
      const [portion] = remaining.splice(chosen.idx, 1);
      const oriented = chosen.flip ? reversePortion(portion) : portion;
      if (chosen.where === "tail") chain.push(oriented);
      else chain.unshift(oriented);
      progress = true;
    }
  }
  // Sécurité : en cas d'égalité pathologique, on n'abandonne aucune portion.
  return chain.concat(remaining);
}

// Géométrie du segment de comblement (source MANUEL) : ligne droite entre les deux
// extrémités des portions BD TOPO adjacentes (préserve la continuité de la chaîne).
function fillerGeometry(from: Position, to: Position): LineString | null {
  if (haversineMeters(from, to) < GAP_FILL_MIN_METERS) return null;
  return { type: "LineString", coordinates: [from, to] };
}

function bdTopoSegment(portion: Portion): AssembledSegment {
  return {
    path: portion.path,
    source: LocalPathSource.BD_TOPO,
    sourceRef: portion.candidate.cleabs,
    type: portion.candidate.suggestedType,
    revetement: portion.candidate.suggestedRevetement,
    largeurMoyenne: portion.candidate.suggestedLargeurMoyenne,
  };
}

// Fraction des points de `path` situés à ≤ DEDUP_TOL_METERS de `cover`.
function coverageRatio(path: LineString, cover: LineString): number {
  const line = lineString(path.coordinates);
  const length = turfLength(line, { units: "meters" });
  const coverLine = lineString(cover.coordinates);
  const count = Math.max(1, Math.round(length / SAMPLE_STEP_METERS));
  let inside = 0;
  for (let i = 0; i <= count; i++) {
    const coord = along(line, (length * i) / count, { units: "meters" })
      .geometry.coordinates as Position;
    const dist =
      nearestPointOnLine(coverLine, coord, { units: "meters" }).properties
        .dist ?? Infinity;
    if (dist <= DEDUP_TOL_METERS) inside++;
  }
  return inside / (count + 1);
}

// Écarte les portions redondantes (doublons/superpositions) qui produiraient des
// allers-retours dans la chaîne : on garde les plus longues et on retire celles
// largement recouvertes par une portion déjà conservée.
function dedupePortions(portions: Portion[]): Portion[] {
  const sorted = [...portions].sort(
    (a, b) =>
      turfLength(lineString(b.path.coordinates), { units: "meters" }) -
      turfLength(lineString(a.path.coordinates), { units: "meters" }),
  );
  const kept: Portion[] = [];
  for (const portion of sorted) {
    const redundant = kept.some(
      (k) => coverageRatio(portion.path, k.path) >= DEDUP_COVER_RATIO,
    );
    if (!redundant) kept.push(portion);
  }
  return kept;
}

/**
 * Assemble des chemins ruraux « prêts à importer » à partir des tronçons BD TOPO qui
 * coïncident géométriquement avec l'habillage cadastral. Chaque chemin cadastral
 * (regroupé par numéro + libellé) devient un chemin composé de segments : portions de
 * tronçons BD TOPO découpées au couloir de tolérance (`source=BD_TOPO`), et segments de
 * comblement en ligne droite là où subsiste un trou ≤ 20 m (`source=MANUEL`). Un trou
 * > 20 m scinde le groupe en chemins distincts (pas de longue ligne droite aberrante).
 */
export function assembleLocalPathsFromCadastre(
  candidates: BdTopoTronconCandidate[],
  cadastralPaths: CadastralRuralPathGeometry[],
): AssembledLocalPath[] {
  const groups = groupCadastralPaths(cadastralPaths);
  const candidatesWithBbox = candidates.map((candidate) => ({
    candidate,
    bbox: bbox(candidate.path) as Bbox,
  }));

  const assembled: AssembledLocalPath[] = [];
  for (const group of groups) {
    const portions: Portion[] = [];
    for (const { candidate, bbox: candidateBbox } of candidatesWithBbox) {
      if (!bboxesOverlap(candidateBbox, group.bbox)) continue;
      for (const path of corridorPortions(candidate.path, group.lines)) {
        portions.push({ path, candidate });
      }
    }
    if (portions.length === 0) continue;

    const ordered = chainPortions(dedupePortions(portions));

    // Découpe la chaîne en sous-chemins à chaque trou > MAX_FILLER_METERS : au-delà,
    // un raccordement en ligne droite n'aurait pas de sens (chemins distincts).
    const runs: AssembledSegment[][] = [];
    let current: AssembledSegment[] = [];
    for (let i = 0; i < ordered.length; i++) {
      if (i > 0) {
        const previous = ordered[i - 1];
        const from = end(previous.path);
        const to = start(ordered[i].path);
        if (haversineMeters(from, to) > MAX_FILLER_METERS) {
          runs.push(current);
          current = [];
        } else {
          const filler = fillerGeometry(from, to);
          if (filler) {
            current.push({
              path: filler,
              source: LocalPathSource.MANUEL,
              sourceRef: null,
              type: previous.candidate.suggestedType,
              revetement: previous.candidate.suggestedRevetement,
              largeurMoyenne: null,
            });
          }
        }
      }
      current.push(bdTopoSegment(ordered[i]));
    }
    if (current.length > 0) runs.push(current);

    runs.forEach((segments, index) => {
      assembled.push({
        key: runs.length > 1 ? `${group.key}#${index}` : group.key,
        numero: group.numero,
        nom: group.nom,
        classement: group.classement,
        segments,
      });
    });
  }
  return assembled;
}
