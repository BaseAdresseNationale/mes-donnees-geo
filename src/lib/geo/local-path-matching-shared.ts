import along from "@turf/along";
import bbox from "@turf/bbox";
import { lineString } from "@turf/helpers";
import turfLength from "@turf/length";
import type { LineString, Position } from "geojson";
import { LocalPathSource } from "@/generated/prisma/browser";
import type { BdTopoTronconCandidate } from "./bd-topo";
import {
  bboxesOverlap,
  MATCH_BUFFER_METERS,
  MIN_SINGLE_SEGMENT_METERS,
  nearestCadastral,
  normalizeLabel,
  SAMPLE_STEP_METERS,
  type AssembledSegment,
  type Bbox,
  type CadastralGroup,
  type CadastralRuralPathGeometry,
} from "./local-path-cadastre-matching";

/** Seuil de couverture du filaire cadastral (et de précision du tracé) pour valider une voie. */
export const MIN_COVERAGE_RATIO = 0.8;
/** Longueur minimale d'une voie assemblée. */
export const MIN_PATH_METERS = MIN_SINGLE_SEGMENT_METERS;

export interface CandidateWithBbox {
  candidate: BdTopoTronconCandidate;
  bbox: Bbox;
}

/** Un tronçon BD TOPO évalué par rapport au filaire d'un groupe cadastral. */
export interface Edge {
  candidate: BdTopoTronconCandidate;
  length: number;
  /** Part (0..1) du tronçon située à ≤ MATCH_BUFFER_METERS du filaire. */
  insideRatio: number;
  /** Indices des échantillons du filaire situés à ≤ MATCH_BUFFER_METERS du tronçon. */
  covered: Set<number>;
}

/**
 * Regroupe les lignes cadastrales par identité stricte (classement + numéro + libellé
 * normalisé identiques). Une ligne sans numéro ni nom reste seule : rien ne dit qu'elle
 * désigne le même chemin qu'une autre.
 */
export function groupCadastralPathsStrict(
  cadastralPaths: CadastralRuralPathGeometry[],
): CadastralGroup[] {
  const groups = new Map<string, CadastralGroup>();
  cadastralPaths.forEach((cadastral, index) => {
    const label = normalizeLabel(cadastral.libelle);
    const named = cadastral.numero !== null || cadastral.nom !== null;
    const key = named
      ? `${cadastral.classement}|${cadastral.numero ?? ""}|${label}`
      : `feat:${index}`;
    const lineBbox = bbox(cadastral.path) as Bbox;
    const existing = groups.get(key);
    if (existing) {
      existing.lines.push(cadastral.path);
      existing.lineBboxes.push(lineBbox);
      existing.bbox = [
        Math.min(existing.bbox[0], lineBbox[0]),
        Math.min(existing.bbox[1], lineBbox[1]),
        Math.max(existing.bbox[2], lineBbox[2]),
        Math.max(existing.bbox[3], lineBbox[3]),
      ];
    } else {
      groups.set(key, {
        key,
        numero: cadastral.numero,
        nom: cadastral.nom,
        classement: cadastral.classement,
        label,
        lines: [cadastral.path],
        lineBboxes: [lineBbox],
        bbox: lineBbox,
      });
    }
  });
  return [...groups.values()];
}

export function withBbox(
  candidates: BdTopoTronconCandidate[],
): CandidateWithBbox[] {
  return candidates.map((candidate) => ({
    candidate,
    bbox: bbox(candidate.path) as Bbox,
  }));
}

/** Cède la main à l'event loop au plus toutes les 20 ms (le traitement tourne dans le serveur Next). */
export function createYielder(): () => Promise<void> {
  let last = Date.now();
  return async () => {
    if (Date.now() - last < 20) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    last = Date.now();
  };
}

export function samplePath(path: LineString): Position[] {
  if (path.coordinates.length < 2) return [];
  const line = lineString(path.coordinates);
  const length = turfLength(line, { units: "meters" });
  if (length === 0) return [path.coordinates[0]];
  const count = Math.max(1, Math.round(length / SAMPLE_STEP_METERS));
  const samples: Position[] = [];
  for (let i = 0; i <= count; i++) {
    samples.push(
      along(line, (length * i) / count, { units: "meters" }).geometry
        .coordinates as Position,
    );
  }
  return samples;
}

export function groupSamples(group: CadastralGroup): Position[] {
  return group.lines.flatMap(samplePath);
}

export async function analyzeEdges(
  group: CadastralGroup,
  samples: Position[],
  pool: CandidateWithBbox[],
  tick: () => Promise<void>,
): Promise<Edge[]> {
  const edges: Edge[] = [];
  for (const { candidate, bbox: candidateBbox } of pool) {
    await tick();
    if (!bboxesOverlap(candidateBbox, group.bbox)) continue;
    const nearbyLines = group.lines.filter((_, i) =>
      bboxesOverlap(candidateBbox, group.lineBboxes[i]),
    );
    if (nearbyLines.length === 0) continue;

    const pathSamples = samplePath(candidate.path);
    if (pathSamples.length === 0) continue;
    const inside = pathSamples.filter(
      (sample) =>
        nearestCadastral(sample, nearbyLines).distance <= MATCH_BUFFER_METERS,
    ).length;
    if (inside === 0) continue;

    const covered = new Set<number>();
    samples.forEach((sample, index) => {
      if (!bboxesOverlap([sample[0], sample[1], sample[0], sample[1]], candidateBbox)) {
        return;
      }
      if (
        nearestCadastral(sample, [candidate.path]).distance <=
        MATCH_BUFFER_METERS
      ) {
        covered.add(index);
      }
    });

    edges.push({
      candidate,
      length: candidate.longueur,
      insideRatio: inside / pathSamples.length,
      covered,
    });
  }
  return edges;
}

export function coverageRatio(edges: Edge[], totalSamples: number): number {
  if (totalSamples === 0) return 0;
  const covered = new Set<number>();
  for (const edge of edges) edge.covered.forEach((i) => covered.add(i));
  return covered.size / totalSamples;
}

export function precisionRatio(edges: Edge[]): number {
  const total = edges.reduce((sum, edge) => sum + edge.length, 0);
  if (total === 0) return 0;
  const inside = edges.reduce(
    (sum, edge) => sum + edge.length * edge.insideRatio,
    0,
  );
  return inside / total;
}

export function nodeKey(position: Position): string {
  return `${position[0].toFixed(6)},${position[1].toFixed(6)}`;
}

/** Composantes connexes (tronçons partageant une extrémité). */
export function connectedComponents(edges: Edge[]): Edge[][] {
  const parent = new Map<string, string>();
  const find = (key: string): string => {
    let root = parent.get(key) ?? key;
    while (root !== (parent.get(root) ?? root)) root = parent.get(root)!;
    parent.set(key, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootA, rootB);
  };

  for (const edge of edges) {
    const coords = edge.candidate.path.coordinates;
    union(nodeKey(coords[0]), nodeKey(coords[coords.length - 1]));
  }

  const components = new Map<string, Edge[]>();
  for (const edge of edges) {
    const root = find(nodeKey(edge.candidate.path.coordinates[0]));
    const component = components.get(root);
    if (component) component.push(edge);
    else components.set(root, [edge]);
  }
  return [...components.values()];
}

export function toBdTopoSegment(
  candidate: BdTopoTronconCandidate,
  path: LineString = candidate.path,
): AssembledSegment {
  return {
    path,
    source: LocalPathSource.BD_TOPO,
    sourceRef: candidate.cleabs,
    type: candidate.suggestedType,
    revetement: candidate.suggestedRevetement,
    largeurMoyenne: candidate.suggestedLargeurMoyenne,
  };
}
