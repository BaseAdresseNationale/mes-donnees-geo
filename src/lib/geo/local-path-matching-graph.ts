import type { LineString, Position } from "geojson";
import type { BdTopoTronconCandidate } from "./bd-topo";
import {
  haversineMeters,
  SAMPLE_STEP_METERS,
  type AssembledLocalPath,
  type CadastralRuralPathGeometry,
} from "./local-path-cadastre-matching";
import {
  analyzeEdges,
  connectedComponents,
  createYielder,
  groupCadastralPathsStrict,
  groupSamples,
  MIN_COVERAGE_RATIO,
  MIN_PATH_METERS,
  nodeKey,
  precisionRatio,
  toBdTopoSegment,
  withBbox,
  type Edge,
} from "./local-path-matching-shared";

// Un tronçon n'entre dans le graphe que s'il est au moins à moitié dans le couloir.
const GRAPH_MIN_EDGE_INSIDE = 0.5;
// Coût d'un tronçon = longueur × (1 + facteur × part hors couloir).
const OUTSIDE_COST_FACTOR = 4;
// Nombre max de terminaux testés par composante (une recherche de plus court chemin chacun).
const MAX_TERMINALS = 10;

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

/**
 * Map matching : le filaire cadastral est calé sur le graphe BD TOPO. Pour chaque
 * composante connexe de tronçons proches du filaire, on retient le plus court chemin
 * (coût pénalisé hors couloir) qui couvre le mieux le filaire. La voie n'est validée que
 * si ≥ 80 % du filaire est couvert et ≥ 80 % du tracé retenu est dans le couloir.
 */
export async function assembleByGraph(
  candidates: BdTopoTronconCandidate[],
  cadastralPaths: CadastralRuralPathGeometry[],
): Promise<AssembledLocalPath[]> {
  const groups = groupCadastralPathsStrict(cadastralPaths);
  const pool = withBbox(candidates);
  const used = new Set<string>();
  const tick = createYielder();
  const assembled: AssembledLocalPath[] = [];

  for (const group of groups) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const samples = groupSamples(group);
    if (samples.length === 0) continue;

    const available = pool.filter(
      ({ candidate }) => !used.has(candidate.cleabs),
    );
    const edges = (await analyzeEdges(group, samples, available, tick)).filter(
      (edge) => edge.insideRatio >= GRAPH_MIN_EDGE_INSIDE,
    );
    if (edges.length === 0) continue;

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
        segments: path.steps.map((step) =>
          toBdTopoSegment(step.edge.edge.candidate, orientedPath(step)),
        ),
        couverture,
      });
    });
  }
  return assembled;
}
