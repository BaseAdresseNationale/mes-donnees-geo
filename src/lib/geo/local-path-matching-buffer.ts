import type { BdTopoTronconCandidate } from "./bd-topo";
import {
  chainPortions,
  type AssembledLocalPath,
  type CadastralRuralPathGeometry,
} from "./local-path-cadastre-matching";
import {
  analyzeEdges,
  connectedComponents,
  coverageRatio,
  createYielder,
  groupCadastralPathsStrict,
  groupSamples,
  MIN_COVERAGE_RATIO,
  MIN_PATH_METERS,
  toBdTopoSegment,
  withBbox,
} from "./local-path-matching-shared";

/**
 * Tout ou rien : seuls les tronçons BD TOPO entiers situés à ≥ 80 % dans le couloir
 * cadastral sont retenus, et la voie n'est validée que si ≥ 80 % du filaire cadastral
 * est couvert par ces tronçons. Pas de découpe ni de comblement.
 */
export async function assembleByBuffer(
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

    const available = pool.filter(({ candidate }) => !used.has(candidate.cleabs));
    const edges = (await analyzeEdges(group, samples, available, tick)).filter(
      (edge) => edge.insideRatio >= MIN_COVERAGE_RATIO,
    );
    if (edges.length === 0) continue;

    const couverture = coverageRatio(edges, samples.length);
    if (couverture < MIN_COVERAGE_RATIO) continue;

    const components = connectedComponents(edges).filter(
      (component) =>
        component.reduce((sum, edge) => sum + edge.length, 0) >= MIN_PATH_METERS,
    );
    components.forEach((component, index) => {
      const ordered = chainPortions(
        component.map((edge) => ({
          path: edge.candidate.path,
          candidate: edge.candidate,
        })),
      );
      for (const { candidate } of ordered) used.add(candidate.cleabs);
      assembled.push({
        key: components.length > 1 ? `${group.key}#${index}` : group.key,
        numero: group.numero,
        nom: group.nom,
        classement: group.classement,
        segments: ordered.map(({ path, candidate }) =>
          toBdTopoSegment(candidate, path),
        ),
        couverture,
      });
    });
  }
  return assembled;
}
