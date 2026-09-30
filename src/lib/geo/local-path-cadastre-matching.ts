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
const MATCH_BUFFER_METERS = 8;
// Pas de tolérance pour l'échantillonnage des tronçons.
const SAMPLE_STEP_METERS = 5;
// Marge large (imprécision bbox/degrés) pour ne jamais écarter à tort un candidat au pré-filtre.
const BBOX_MARGIN_DEGREES = 0.005;
// En-deçà de ce seuil, le trou entre deux portions est ignoré (l'éditeur tolère ~2 m).
const GAP_FILL_MIN_METERS = 2;
// Longueur max d'un raccordement en ligne droite ; au-delà, on scinde en 2 chemins distincts.
const MAX_FILLER_METERS = 150;
// Écart d'orientation max (mod 180°) entre un tronçon et le tracé cadastral local :
// au-delà, le tronçon est jugé transversal (intersection/amorce) et écarté.
const MAX_BEARING_DIFF_DEGREES = 45;
// Dédoublonnage : une portion dont ≥ DEDUP_COVER_RATIO des points sont à ≤ DEDUP_TOL_METERS
// d'une portion plus longue déjà retenue est jugée redondante (doublon/superposition BD TOPO).
const DEDUP_TOL_METERS = 5;
const DEDUP_COVER_RATIO = 0.7;
// Un chemin assemblé composé d'un seul segment plus court que ça n'est pas créé (bruit,
// amorce de tronçon sans intérêt pratique).
const MIN_SINGLE_SEGMENT_METERS = 40;
// Seuil de similarité (0..1, cf. `labelSimilarity`) au-dessus duquel deux libellés
// cadastraux (à numéro égal) sont considérés comme désignant le même chemin.
const LABEL_SIMILARITY_THRESHOLD = 0.6;
// Tolérance (plus large que MATCH_BUFFER_METERS) pour comparer deux chemins ASSEMBLÉS
// entiers entre eux — leurs segments MANUEL peuvent diverger davantage qu'un simple
// tronçon BD TOPO du tracé cadastral.
const DUPLICATE_PATH_TOLERANCE_METERS = 15;
// En-deçà de cette distance, 2 segments consécutifs qui ramènent quasiment au point de
// départ du 1er sont jugés « s'annuler » (aller-retour, pas un vrai prolongement).
const CANCELLING_SEGMENT_TOLERANCE_METERS = 5;

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
  /** Libellé normalisé du 1er membre du groupe, utilisé comme référence pour la similarité. */
  label: string;
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

// Normalise un libellé pour la comparaison (accents/casse/espaces insensibles).
function normalizeLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// Distance d'édition (Levenshtein) entre deux chaînes, en O(a.length * b.length) en temps
// et O(min(a.length, b.length)) en mémoire (2 lignes de la matrice DP).
function levenshteinDistance(a: string, b: string): number {
  if (a.length < b.length) return levenshteinDistance(b, a);
  if (b.length === 0) return a.length;

  let previousRow = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 0; i < a.length; i++) {
    const currentRow = [i + 1];
    for (let j = 0; j < b.length; j++) {
      const insertCost = currentRow[j] + 1;
      const deleteCost = previousRow[j + 1] + 1;
      const substituteCost = previousRow[j] + (a[i] === b[j] ? 0 : 1);
      currentRow.push(Math.min(insertCost, deleteCost, substituteCost));
    }
    previousRow = currentRow;
  }
  return previousRow[b.length];
}

// Similarité normalisée entre 0 (rien en commun) et 1 (identiques).
function labelSimilarity(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLength;
}

// Regroupe les chemins ruraux cadastraux par identité : même numéro ET libellé « proche »
// (distance d'édition normalisée ≥ seuil) d'un groupe déjà constitué — un matching sur
// libellé strictement égal était trop fragile (variantes de ponctuation/graphie). Fallback
// sur l'index de feature si pas de libellé (aucune base de comparaison fiable).
function groupCadastralPaths(
  cadastralPaths: CadastralRuralPathGeometry[],
): CadastralGroup[] {
  const groups: CadastralGroup[] = [];
  cadastralPaths.forEach((cadastral, index) => {
    const label = normalizeLabel(cadastral.libelle);
    const lineBbox = bbox(cadastral.path) as Bbox;
    const existing = label
      ? groups.find(
          (group) =>
            group.label !== "" &&
            group.classement === cadastral.classement &&
            group.numero === cadastral.numero &&
            labelSimilarity(group.label, label) >= LABEL_SIMILARITY_THRESHOLD,
        )
      : undefined;
    if (existing) {
      existing.lines.push(cadastral.path);
      existing.bbox = mergeBbox(existing.bbox, lineBbox);
      existing.numero ??= cadastral.numero;
      existing.nom ??= cadastral.nom;
    } else {
      groups.push({
        key: label
          ? `${cadastral.classement}|${cadastral.numero ?? ""}|${label}`
          : `feat:${index}`,
        numero: cadastral.numero,
        nom: cadastral.nom,
        classement: cadastral.classement,
        label,
        lines: [cadastral.path],
        bbox: lineBbox,
      });
    }
  });
  return groups;
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

function assembledPathLines(path: AssembledLocalPath): LineString[] {
  return path.segments.map((segment) => segment.path);
}

function assembledPathLength(path: AssembledLocalPath): number {
  return path.segments.reduce(
    (total, segment) =>
      total +
      turfLength(lineString(segment.path.coordinates), { units: "meters" }),
    0,
  );
}

// Fraction des points échantillonnés de `lines` situés à ≤ `toleranceMeters` d'au moins
// une ligne de `otherLines` (même principe que `coverageRatio`, mais sur plusieurs lignes
// de chaque côté).
function linesOverlapRatio(
  lines: LineString[],
  otherLines: LineString[],
  toleranceMeters: number,
): number {
  let sampled = 0;
  let inside = 0;
  for (const path of lines) {
    if (path.coordinates.length < 2) continue;
    const line = lineString(path.coordinates);
    const length = turfLength(line, { units: "meters" });
    if (length === 0) continue;
    const count = Math.max(1, Math.round(length / SAMPLE_STEP_METERS));
    for (let i = 0; i <= count; i++) {
      const coord = along(line, (length * i) / count, { units: "meters" })
        .geometry.coordinates as Position;
      sampled++;
      if (nearestCadastral(coord, otherLines).distance <= toleranceMeters) {
        inside++;
      }
    }
  }
  return sampled === 0 ? 0 : inside / sampled;
}

// Post-traitement : deux chemins assemblés portant le même numéro et le même nom (une
// fois normalisés) et dont le tracé du plus court est presque entièrement superposé au
// tracé du plus long sont un doublon (ex. libellés cadastraux voisins non fusionnés en
// amont). On ne garde alors que le plus long.
function dedupeAssembledPaths(
  paths: AssembledLocalPath[],
): AssembledLocalPath[] {
  const groups = new Map<string, AssembledLocalPath[]>();
  for (const path of paths) {
    const nom = path.nom ? normalizeLabel(path.nom) : "";
    if (!nom) continue;
    const groupKey = `${path.numero ?? ""}|${nom}`;
    const group = groups.get(groupKey);
    if (group) group.push(path);
    else groups.set(groupKey, [path]);
  }

  const discarded = new Set<AssembledLocalPath>();
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (discarded.has(a) || discarded.has(b)) continue;
        const [shorter, longer] =
          assembledPathLength(a) <= assembledPathLength(b) ? [a, b] : [b, a];
        const ratio = linesOverlapRatio(
          assembledPathLines(shorter),
          assembledPathLines(longer),
          DUPLICATE_PATH_TOLERANCE_METERS,
        );
        if (ratio >= DEDUP_COVER_RATIO) discarded.add(shorter);
      }
    }
  }
  return paths.filter((path) => !discarded.has(path));
}

// Écarte les paires de segments consécutifs qui « s'annulent » : le 2e ramène (à
// CANCELLING_SEGMENT_TOLERANCE_METERS près) au point de départ du 1er, signe d'un
// aller-retour parasite (ex. impasse chaînée par erreur) plutôt que d'un vrai tracé. La
// jonction restante est recollée sur ce point de départ pour garder la chaîne contiguë.
function removeCancellingSegments(
  segments: AssembledSegment[],
): AssembledSegment[] {
  const result = segments.map((segment) => ({ ...segment }));
  let i = 0;
  while (i < result.length - 1) {
    const anchor = start(result[i].path);
    const after = end(result[i + 1].path);
    if (haversineMeters(anchor, after) > CANCELLING_SEGMENT_TOLERANCE_METERS) {
      i++;
      continue;
    }
    result.splice(i, 2);
    const next = result[i];
    if (next) {
      next.path = {
        type: "LineString",
        coordinates: [anchor, ...next.path.coordinates.slice(1)],
      };
    }
    i = Math.max(i - 1, 0);
  }
  return result;
}

/**
 * Assemble des chemins ruraux « prêts à importer » à partir des tronçons BD TOPO qui
 * coïncident géométriquement avec l'habillage cadastral. Chaque chemin cadastral
 * (regroupé par numéro + proximité de libellé) devient un chemin composé de segments :
 * portions de tronçons BD TOPO découpées au couloir de tolérance (`source=BD_TOPO`), et
 * segments de comblement en ligne droite là où subsiste un trou ≤ 20 m (`source=MANUEL`).
 * Un trou > 20 m scinde le groupe en chemins distincts (pas de longue ligne droite
 * aberrante). Les allers-retours parasites (2 segments qui s'annulent) sont retirés, un
 * chemin qui se résume à un seul segment de moins de 40 m est écarté, et un doublon
 * (même numéro + nom, tracé superposé) au profit du plus long.
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

    runs.forEach((rawSegments, index) => {
      const segments = removeCancellingSegments(rawSegments);
      if (segments.length === 0) return;
      if (segments.length === 1) {
        const length = turfLength(lineString(segments[0].path.coordinates), {
          units: "meters",
        });
        if (length < MIN_SINGLE_SEGMENT_METERS) return;
      }
      assembled.push({
        key: runs.length > 1 ? `${group.key}#${index}` : group.key,
        numero: group.numero,
        nom: group.nom,
        classement: group.classement,
        segments,
      });
    });
  }
  return dedupeAssembledPaths(assembled);
}
