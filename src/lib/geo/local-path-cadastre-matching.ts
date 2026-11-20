import bbox from "@turf/bbox";
import { lineString } from "@turf/helpers";
import turfLength from "@turf/length";
import type { LineString, Position } from "geojson";
import {
  LocalPathSource,
  type LocalPathClassement,
  type LocalPathRevetement,
  type LocalPathType,
} from "@/generated/prisma/browser";
import type { BdTopoTronconCandidate } from "./bd-topo";

// Couloir de tolérance entre un tronçon BD TOPO et le tracé cadastral de référence.
const MATCH_BUFFER_METERS = 8;
// Pas d'échantillonnage des tronçons et du filaire cadastral.
const SAMPLE_STEP_METERS = 5;
// Marge du pré-filtre bbox (~55 m en latitude), très supérieure à MATCH_BUFFER_METERS.
const BBOX_MARGIN_DEGREES = 0.0005;
// Une voie n'est validée que si ≥ 80 % du filaire cadastral est couvert et ≥ 80 % du
// tracé retenu est dans le couloir.
const MIN_COVERAGE_RATIO = 0.8;
// Longueur minimale d'une voie assemblée (en-deçà, c'est du bruit).
const MIN_PATH_METERS = 40;
// Un tronçon n'entre dans le graphe que s'il est au moins à moitié dans le couloir.
const GRAPH_MIN_EDGE_INSIDE = 0.5;
// Un tronçon moins bien aligné n'est retenu que s'il relie deux composantes admises ("pont").
const BRIDGE_MIN_INSIDE = 0.3;
// Coût d'un tronçon = longueur × (1 + facteur × part hors couloir).
const OUTSIDE_COST_FACTOR = 4;
// Nombre max de terminaux testés par composante (une recherche de plus court chemin chacun).
const MAX_TERMINALS = 10;
// Longueur max d'un segment manuel reliant deux chemins d'une même voie.
const MAX_JOIN_METERS = 200;
// Similarité minimale des noms pour considérer deux chemins comme une même voie.
const JOIN_NAME_SIMILARITY = 0.8;
// En-deçà de ce seuil, le trou entre deux chemins est ignoré (l'éditeur tolère ~2 m).
const GAP_FILL_MIN_METERS = 2;

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
  /** Clé stable (classement, numéro, libellé, sinon index de feature) : sélecteur d'import. */
  key: string;
  numero: number | null;
  nom: string | null;
  classement: LocalPathClassement;
  segments: AssembledSegment[];
  /** Part (0..1) du filaire cadastral couverte par le tracé BD TOPO. */
  couverture?: number;
}

type Bbox = [number, number, number, number];

interface CadastralGroup {
  key: string;
  numero: number | null;
  nom: string | null;
  classement: LocalPathClassement;
  lines: LineString[];
  lineBboxes: Bbox[];
  bbox: Bbox;
}

interface CandidateWithBbox {
  candidate: BdTopoTronconCandidate;
  bbox: Bbox;
  // Calculé à la demande puis réutilisé pour tous les groupes cadastraux.
  samples?: Position[];
}

/** Un tronçon BD TOPO évalué par rapport au filaire d'un groupe cadastral. */
interface Edge {
  candidate: BdTopoTronconCandidate;
  length: number;
  /** Part (0..1) du tronçon située à ≤ MATCH_BUFFER_METERS du filaire. */
  insideRatio: number;
  /** Indices des échantillons du filaire situés à ≤ MATCH_BUFFER_METERS du tronçon. */
  covered: Set<number>;
}

interface GraphEdge {
  edge: Edge;
  from: number;
  to: number;
  cost: number;
}

interface Graph {
  nodes: Position[];
  edges: GraphEdge[];
  adjacency: { edge: number; other: number }[][];
}

interface Step {
  edge: GraphEdge;
  from: number;
}

interface ChosenPath {
  steps: Step[];
  edges: Edge[];
  covered: Set<number>;
  length: number;
}

// ---------------------------------------------------------------------------
// Géométrie et chaînes de caractères
// ---------------------------------------------------------------------------

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

// Distance (m) d'un point à l'ensemble de lignes. Projection planaire locale : exacte à
// quelques mètres, bien plus rapide que `nearestPointOnLine` de turf (appelé des millions
// de fois sur de grosses communes).
function distanceToLines(coord: Position, lines: LineString[]): number {
  const metersPerDegree = (Math.PI / 180) * 6_371_000;
  const kx = Math.cos((coord[1] * Math.PI) / 180) * metersPerDegree;
  const ky = metersPerDegree;
  let bestSq = Infinity;
  for (const line of lines) {
    const coords = line.coordinates;
    for (let i = 0; i < coords.length - 1; i++) {
      const ax = (coords[i][0] - coord[0]) * kx;
      const ay = (coords[i][1] - coord[1]) * ky;
      const dx = (coords[i + 1][0] - coord[0]) * kx - ax;
      const dy = (coords[i + 1][1] - coord[1]) * ky - ay;
      const lenSq = dx * dx + dy * dy;
      // Comparaisons plutôt que Math.min/max : boucle exécutée des millions de fois.
      const projected = lenSq === 0 ? 0 : -(ax * dx + ay * dy) / lenSq;
      const t = projected < 0 ? 0 : projected > 1 ? 1 : projected;
      const px = ax + t * dx;
      const py = ay + t * dy;
      const sq = px * px + py * py;
      if (sq < bestSq) bestSq = sq;
    }
  }
  return Math.sqrt(bestSq);
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

// Distance d'édition (Levenshtein), en O(a.length * b.length) en temps et
// O(min(a.length, b.length)) en mémoire.
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

function nodeKey(position: Position): string {
  return `${position[0].toFixed(6)},${position[1].toFixed(6)}`;
}

// Cède la main à l'event loop au plus toutes les 20 ms (le traitement tourne dans le serveur Next).
function createYielder(): () => Promise<void> {
  let last = Date.now();
  return async () => {
    if (Date.now() - last < 20) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    last = Date.now();
  };
}

function samplePath(path: LineString): Position[] {
  const coords = path.coordinates;
  if (coords.length < 2) return [];
  const segmentLengths: number[] = [];
  let length = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const segmentLength = haversineMeters(coords[i], coords[i + 1]);
    segmentLengths.push(segmentLength);
    length += segmentLength;
  }
  if (length === 0) return [coords[0]];

  // Un seul parcours de la ligne, interpolation linéaire dans chaque segment.
  const count = Math.max(1, Math.round(length / SAMPLE_STEP_METERS));
  const samples: Position[] = [];
  let segment = 0;
  let walked = 0;
  for (let i = 0; i <= count; i++) {
    const target = (length * i) / count;
    while (
      segment < segmentLengths.length - 1 &&
      walked + segmentLengths[segment] < target
    ) {
      walked += segmentLengths[segment];
      segment++;
    }
    const ratio =
      segmentLengths[segment] === 0
        ? 0
        : Math.min(1, (target - walked) / segmentLengths[segment]);
    const a = coords[segment];
    const b = coords[segment + 1];
    samples.push([a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio]);
  }
  return samples;
}

// ---------------------------------------------------------------------------
// Regroupement cadastral et évaluation des tronçons
// ---------------------------------------------------------------------------

// Regroupe les lignes cadastrales par identité stricte (classement + numéro + libellé
// normalisé identiques). Une ligne sans numéro ni nom reste seule : rien ne dit qu'elle
// désigne le même chemin qu'une autre.
function groupCadastralPaths(
  cadastralPaths: CadastralRuralPathGeometry[],
): CadastralGroup[] {
  const groups = new Map<string, CadastralGroup>();
  cadastralPaths.forEach((cadastral, index) => {
    const named = cadastral.numero !== null || cadastral.nom !== null;
    const key = named
      ? `${cadastral.classement}|${cadastral.numero ?? ""}|${normalizeLabel(cadastral.libelle)}`
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
        lines: [cadastral.path],
        lineBboxes: [lineBbox],
        bbox: lineBbox,
      });
    }
  });
  return [...groups.values()];
}

async function analyzeEdges(
  group: CadastralGroup,
  samples: Position[],
  pool: CandidateWithBbox[],
  tick: () => Promise<void>,
): Promise<Edge[]> {
  const edges: Edge[] = [];
  for (const item of pool) {
    const { candidate, bbox: candidateBbox } = item;
    await tick();
    if (!bboxesOverlap(candidateBbox, group.bbox)) continue;
    const nearbyLines = group.lines.filter((_, i) =>
      bboxesOverlap(candidateBbox, group.lineBboxes[i]),
    );
    if (nearbyLines.length === 0) continue;

    const pathSamples = (item.samples ??= samplePath(candidate.path));
    if (pathSamples.length === 0) continue;
    const inside = pathSamples.filter(
      (sample) => distanceToLines(sample, nearbyLines) <= MATCH_BUFFER_METERS,
    ).length;
    if (inside === 0) continue;

    const covered = new Set<number>();
    samples.forEach((sample, index) => {
      const samplePoint: Bbox = [sample[0], sample[1], sample[0], sample[1]];
      if (!bboxesOverlap(samplePoint, candidateBbox)) return;
      if (distanceToLines(sample, [candidate.path]) <= MATCH_BUFFER_METERS) {
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

function precisionRatio(edges: Edge[]): number {
  const total = edges.reduce((sum, edge) => sum + edge.length, 0);
  if (total === 0) return 0;
  const inside = edges.reduce(
    (sum, edge) => sum + edge.length * edge.insideRatio,
    0,
  );
  return inside / total;
}

// Composantes connexes (tronçons partageant une extrémité).
function connectedComponents(edges: Edge[]): Edge[][] {
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

// Tronçons partiellement hors couloir (ex. filaire décalé) qui raccordent deux composantes
// admises : sans eux, une voie continue serait coupée en plusieurs chemins. On ne garde
// que le mieux aligné par paire de composantes.
function findBridges(admitted: Edge[], all: Edge[]): Edge[] {
  const componentOf = new Map<string, number>();
  connectedComponents(admitted).forEach((component, index) => {
    for (const edge of component) {
      const coords = edge.candidate.path.coordinates;
      componentOf.set(nodeKey(coords[0]), index);
      componentOf.set(nodeKey(coords[coords.length - 1]), index);
    }
  });

  const bestByPair = new Map<string, Edge>();
  for (const edge of all) {
    if (
      edge.insideRatio >= GRAPH_MIN_EDGE_INSIDE ||
      edge.insideRatio < BRIDGE_MIN_INSIDE
    ) {
      continue;
    }
    const coords = edge.candidate.path.coordinates;
    const a = componentOf.get(nodeKey(coords[0]));
    const b = componentOf.get(nodeKey(coords[coords.length - 1]));
    if (a === undefined || b === undefined || a === b) continue;
    const pair = a < b ? `${a}|${b}` : `${b}|${a}`;
    const current = bestByPair.get(pair);
    if (!current || edge.insideRatio > current.insideRatio) {
      bestByPair.set(pair, edge);
    }
  }
  return [...bestByPair.values()];
}

// ---------------------------------------------------------------------------
// Graphe et plus court chemin
// ---------------------------------------------------------------------------

function buildGraph(edges: Edge[]): Graph {
  const index = new Map<string, number>();
  const nodes: Position[] = [];
  const nodeOf = (position: Position): number => {
    const key = nodeKey(position);
    let i = index.get(key);
    if (i === undefined) {
      i = nodes.length;
      index.set(key, i);
      nodes.push(position);
    }
    return i;
  };

  const graphEdges: GraphEdge[] = edges.map((edge) => {
    const coords = edge.candidate.path.coordinates;
    return {
      edge,
      from: nodeOf(coords[0]),
      to: nodeOf(coords[coords.length - 1]),
      cost: edge.length * (1 + OUTSIDE_COST_FACTOR * (1 - edge.insideRatio)),
    };
  });

  const adjacency = nodes.map(() => [] as { edge: number; other: number }[]);
  graphEdges.forEach((graphEdge, i) => {
    if (graphEdge.from === graphEdge.to) return;
    adjacency[graphEdge.from].push({ edge: i, other: graphEdge.to });
    adjacency[graphEdge.to].push({ edge: i, other: graphEdge.from });
  });
  return { nodes, edges: graphEdges, adjacency };
}

// Dijkstra en O(V²) : les graphes par voie comptent quelques dizaines de nœuds.
function shortestPaths(graph: Graph, source: number) {
  const size = graph.nodes.length;
  const dist = new Array<number>(size).fill(Infinity);
  const via = new Array<{ edge: number; prev: number } | null>(size).fill(null);
  const done = new Array<boolean>(size).fill(false);
  dist[source] = 0;
  for (let round = 0; round < size; round++) {
    let current = -1;
    for (let i = 0; i < size; i++) {
      if (!done[i] && (current === -1 || dist[i] < dist[current])) current = i;
    }
    if (current === -1 || dist[current] === Infinity) break;
    done[current] = true;
    for (const { edge, other } of graph.adjacency[current]) {
      const next = dist[current] + graph.edges[edge].cost;
      if (next < dist[other]) {
        dist[other] = next;
        via[other] = { edge, prev: current };
      }
    }
  }
  return { dist, via };
}

function reconstruct(
  graph: Graph,
  via: ({ edge: number; prev: number } | null)[],
  target: number,
): Step[] {
  const steps: Step[] = [];
  let current = target;
  for (let hop = via[current]; hop; hop = via[current]) {
    steps.push({ edge: graph.edges[hop.edge], from: hop.prev });
    current = hop.prev;
  }
  return steps.reverse();
}

// Terminaux candidats : les feuilles (extrémités de la composante), sinon tous les nœuds ;
// on garde les plus éloignés du centre pour borner le nombre de recherches.
function pickTerminals(graph: Graph): number[] {
  const leaves = graph.adjacency.flatMap((links, i) =>
    links.length === 1 ? [i] : [],
  );
  const terminals = leaves.length >= 2 ? leaves : graph.nodes.map((_, i) => i);
  if (terminals.length <= MAX_TERMINALS) return terminals;
  const center: Position = [
    graph.nodes.reduce((sum, node) => sum + node[0], 0) / graph.nodes.length,
    graph.nodes.reduce((sum, node) => sum + node[1], 0) / graph.nodes.length,
  ];
  return terminals
    .map((i) => ({ i, d: haversineMeters(graph.nodes[i], center) }))
    .sort((a, b) => b.d - a.d)
    .slice(0, MAX_TERMINALS)
    .map(({ i }) => i);
}

// Meilleur chemin entre deux terminaux : maximise le filaire couvert et pénalise la
// longueur hors couloir (écarte les antennes et impasses).
function bestPathInComponent(edges: Edge[]): ChosenPath | null {
  const graph = buildGraph(edges);
  const terminals = pickTerminals(graph);
  let best: (ChosenPath & { score: number }) | null = null;

  for (let a = 0; a < terminals.length; a++) {
    const { dist, via } = shortestPaths(graph, terminals[a]);
    for (let b = a + 1; b < terminals.length; b++) {
      if (dist[terminals[b]] === Infinity) continue;
      const steps = reconstruct(graph, via, terminals[b]);
      if (steps.length === 0) continue;

      const pathEdges = steps.map((step) => step.edge.edge);
      const covered = new Set<number>();
      let length = 0;
      let inside = 0;
      for (const edge of pathEdges) {
        edge.covered.forEach((i) => covered.add(i));
        length += edge.length;
        inside += edge.length * edge.insideRatio;
      }
      const score = covered.size - (length - inside) / SAMPLE_STEP_METERS;
      if (!best || score > best.score) {
        best = { steps, edges: pathEdges, covered, length, score };
      }
    }
  }
  return best;
}

function orientedPath(step: Step): LineString {
  const coordinates = step.edge.edge.candidate.path.coordinates;
  return {
    type: "LineString",
    coordinates:
      step.edge.from === step.from ? coordinates : [...coordinates].reverse(),
  };
}

function toBdTopoSegment(step: Step): AssembledSegment {
  const { candidate } = step.edge.edge;
  return {
    path: orientedPath(step),
    source: LocalPathSource.BD_TOPO,
    sourceRef: candidate.cleabs,
    type: candidate.suggestedType,
    revetement: candidate.suggestedRevetement,
    largeurMoyenne: candidate.suggestedLargeurMoyenne,
  };
}

// ---------------------------------------------------------------------------
// Jonction des chemins d'une même voie et noms BD TOPO
// ---------------------------------------------------------------------------

function isSameVoie(a: AssembledLocalPath, b: AssembledLocalPath): boolean {
  if (a.classement !== b.classement || a.numero !== b.numero) return false;
  if (!a.nom || !b.nom) return false;
  return (
    labelSimilarity(normalizeLabel(a.nom), normalizeLabel(b.nom)) >=
    JOIN_NAME_SIMILARITY
  );
}

function reverseSegments(segments: AssembledSegment[]): AssembledSegment[] {
  return [...segments].reverse().map((segment) => ({
    ...segment,
    path: {
      type: "LineString",
      coordinates: [...segment.path.coordinates].reverse(),
    },
  }));
}

function firstPosition(segments: AssembledSegment[]): Position {
  return segments[0].path.coordinates[0];
}

function lastPosition(segments: AssembledSegment[]): Position {
  const coordinates = segments[segments.length - 1].path.coordinates;
  return coordinates[coordinates.length - 1];
}

// Relie par un segment manuel droit (≤ 200 m) les chemins d'une même voie (même
// classement, même numéro, noms similaires à ≥ 80 %) séparés par un trou de la BD TOPO.
// On relie toujours la paire d'extrémités la plus proche, jusqu'à épuisement.
function joinPathsAcrossGaps(
  paths: AssembledLocalPath[],
): AssembledLocalPath[] {
  const result = [...paths];
  for (;;) {
    let best: {
      i: number;
      j: number;
      aAtEnd: boolean;
      bAtStart: boolean;
      distance: number;
    } | null = null;

    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        if (!isSameVoie(result[i], result[j])) continue;
        const aEnds = [
          { atEnd: false, position: firstPosition(result[i].segments) },
          { atEnd: true, position: lastPosition(result[i].segments) },
        ];
        const bEnds = [
          { atStart: true, position: firstPosition(result[j].segments) },
          { atStart: false, position: lastPosition(result[j].segments) },
        ];
        for (const a of aEnds) {
          for (const b of bEnds) {
            const distance = haversineMeters(a.position, b.position);
            if (
              distance <= MAX_JOIN_METERS &&
              (!best || distance < best.distance)
            ) {
              best = { i, j, aAtEnd: a.atEnd, bAtStart: b.atStart, distance };
            }
          }
        }
      }
    }
    if (!best) return result;

    const a = result[best.i];
    const b = result[best.j];
    const aSegments = best.aAtEnd ? a.segments : reverseSegments(a.segments);
    const bSegments = best.bAtStart ? b.segments : reverseSegments(b.segments);
    const previous = aSegments[aSegments.length - 1];
    const filler: AssembledSegment[] =
      best.distance >= GAP_FILL_MIN_METERS
        ? [
            {
              path: {
                type: "LineString",
                coordinates: [
                  lastPosition(aSegments),
                  firstPosition(bSegments),
                ],
              },
              source: LocalPathSource.MANUEL,
              sourceRef: null,
              type: previous.type,
              revetement: previous.revetement,
              largeurMoyenne: null,
            },
          ]
        : [];

    result[best.i] = {
      ...a,
      segments: [...aSegments, ...filler, ...bSegments],
      couverture:
        a.couverture !== undefined && b.couverture !== undefined
          ? Math.min(a.couverture, b.couverture)
          : a.couverture,
    };
    result.splice(best.j, 1);
  }
}

// Les chemins sans nom cadastral prennent le nom BD TOPO (`nomVoie`) le plus présent, en
// longueur, parmi leurs tronçons.
function fillMissingNamesFromBdTopo(
  paths: AssembledLocalPath[],
  candidates: BdTopoTronconCandidate[],
): AssembledLocalPath[] {
  const nameByCleabs = new Map<string, string>();
  for (const candidate of candidates) {
    if (candidate.nomVoie)
      nameByCleabs.set(candidate.cleabs, candidate.nomVoie);
  }

  return paths.map((path) => {
    if (path.nom) return path;
    const lengthByName = new Map<string, number>();
    for (const segment of path.segments) {
      const name = segment.sourceRef && nameByCleabs.get(segment.sourceRef);
      if (!name) continue;
      const length = turfLength(lineString(segment.path.coordinates), {
        units: "meters",
      });
      lengthByName.set(name, (lengthByName.get(name) ?? 0) + length);
    }
    const [best] = [...lengthByName.entries()].sort((a, b) => b[1] - a[1]);
    return best ? { ...path, nom: best[0] } : path;
  });
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

/**
 * Reconstitue les voies locales en calant le filaire cadastral sur le graphe BD TOPO
 * (map matching). Pour chaque groupe cadastral (même classement, numéro et libellé), on
 * retient dans chaque composante connexe de tronçons proches le plus court chemin (coût
 * pénalisé hors couloir) qui couvre le mieux le filaire. Les chemins d'une même voie
 * séparés par un trou ≤ 200 m sont reliés par un segment manuel, et les voies sans nom
 * cadastral prennent le nom BD TOPO.
 */
export async function assembleLocalPaths(
  candidates: BdTopoTronconCandidate[],
  cadastralPaths: CadastralRuralPathGeometry[],
): Promise<AssembledLocalPath[]> {
  const groups = groupCadastralPaths(cadastralPaths);
  const pool: CandidateWithBbox[] = candidates.map((candidate) => ({
    candidate,
    bbox: bbox(candidate.path) as Bbox,
  }));
  const used = new Set<string>();
  const tick = createYielder();
  const assembled: AssembledLocalPath[] = [];

  for (const group of groups) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const samples = group.lines.flatMap(samplePath);
    if (samples.length === 0) continue;

    const available = pool.filter(
      ({ candidate }) => !used.has(candidate.cleabs),
    );
    const analyzed = await analyzeEdges(group, samples, available, tick);
    const admitted = analyzed.filter(
      (edge) => edge.insideRatio >= GRAPH_MIN_EDGE_INSIDE,
    );
    if (admitted.length === 0) continue;
    const edges = [...admitted, ...findBridges(admitted, analyzed)];

    const chosen: ChosenPath[] = [];
    for (const component of connectedComponents(edges)) {
      await tick();
      const path = bestPathInComponent(component);
      if (path && path.covered.size > 0 && path.length >= MIN_PATH_METERS) {
        chosen.push(path);
      }
    }
    if (chosen.length === 0) continue;

    const covered = new Set<number>();
    for (const path of chosen) path.covered.forEach((i) => covered.add(i));
    const couverture = covered.size / samples.length;
    const precision = precisionRatio(chosen.flatMap((path) => path.edges));
    if (couverture < MIN_COVERAGE_RATIO || precision < MIN_COVERAGE_RATIO) {
      continue;
    }

    chosen.forEach((path, index) => {
      for (const step of path.steps) {
        used.add(step.edge.edge.candidate.cleabs);
      }
      assembled.push({
        key: chosen.length > 1 ? `${group.key}#${index}` : group.key,
        numero: group.numero,
        nom: group.nom,
        classement: group.classement,
        segments: path.steps.map(toBdTopoSegment),
        couverture,
      });
    });
  }
  return fillMissingNamesFromBdTopo(joinPathsAcrossGaps(assembled), candidates);
}
