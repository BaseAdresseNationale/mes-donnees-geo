import "server-only";
import { BdTopoService } from "./bd-topo";
import { CadastreService } from "./cadastre";
import {
  assembleLocalPaths,
  type AssembledLocalPath,
} from "./local-path-cadastre-matching";

export async function assembleForCommune(
  codeInsee: string,
): Promise<AssembledLocalPath[]> {
  const [candidates, toponyms] = await Promise.all([
    BdTopoService.findTronconsForCommune(codeInsee),
    CadastreService.findLocalPathToponymsForCommune(codeInsee),
  ]);
  const cadastralPaths = toponyms.map((feature) => ({
    path: feature.geometry,
    ...feature.properties,
  }));
  return assembleLocalPaths(candidates, cadastralPaths);
}
