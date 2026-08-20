import "server-only";
import { getRuralPaths as getRuralPathsFromDb } from "@/lib/db/chemins-ruraux";

import type { RuralPath } from "@/components/CheminsRuraux/types";

export function getRuralPaths(codeCommune: string): Promise<RuralPath[]> {
  return getRuralPathsFromDb(codeCommune);
}
