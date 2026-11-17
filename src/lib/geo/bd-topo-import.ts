import "server-only";
import { BdTopoService } from "./bd-topo";
import { CadastreService } from "./cadastre";
import {
  assembleLocalPathsFromCadastre,
  type AssembledLocalPath,
} from "./local-path-cadastre-matching";
import { assembleByBuffer } from "./local-path-matching-buffer";
import { assembleByGraph } from "./local-path-matching-graph";
import { LocalPathClassement } from "@/components/voies-locales/types";
import {
  DEFAULT_IMPORT_ALGORITHM,
  type ImportAlgorithm,
} from "@/components/voies-locales/import/algorithms";

const ASSEMBLERS = {
  legacy: assembleLocalPathsFromCadastre,
  buffer: assembleByBuffer,
  graph: assembleByGraph,
} satisfies Record<ImportAlgorithm, typeof assembleLocalPathsFromCadastre>;

export async function assembleForCommune(
  codeInsee: string,
  algorithm: ImportAlgorithm = DEFAULT_IMPORT_ALGORITHM,
): Promise<AssembledLocalPath[]> {
  const [candidates, ruralPaths, voiesCommunales] = await Promise.all([
    BdTopoService.findTronconsForCommune(codeInsee),
    CadastreService.findRuralPathToponymsForCommune(codeInsee),
    CadastreService.findVoieCommunaleToponymsForCommune(codeInsee),
  ]);
  const cadastralPaths = [
    ...ruralPaths.map((feature) => ({
      path: feature.geometry,
      numero: feature.properties.numero,
      nom: feature.properties.nom,
      libelle: feature.properties.libelle,
      classement: LocalPathClassement.CHEMIN_RURAL,
    })),
    ...voiesCommunales.map((feature) => ({
      path: feature.geometry,
      numero: feature.properties.numero,
      nom: feature.properties.nom,
      libelle: feature.properties.libelle,
      classement: LocalPathClassement.VOIE_COMMUNALE,
    })),
  ];
  return ASSEMBLERS[algorithm](candidates, cadastralPaths);
}

export function isAlreadyImported(
  assembled: AssembledLocalPath,
  importedRefs: Set<string>,
): boolean {
  const refs = assembled.segments
    .map((segment) => segment.sourceRef)
    .filter((ref): ref is string => ref != null);
  return refs.length > 0 && refs.every((ref) => importedRefs.has(ref));
}