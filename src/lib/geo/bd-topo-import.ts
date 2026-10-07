import "server-only";
import { BdTopoService } from "./bd-topo";
import { CadastreService } from "./cadastre";
import {
  assembleLocalPathsFromCadastre,
  type AssembledLocalPath,
} from "./local-path-cadastre-matching";
import { LocalPathClassement } from "@/components/voies-locales/types";

export async function assembleForCommune(
  codeInsee: string,
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
  return assembleLocalPathsFromCadastre(candidates, cadastralPaths);
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