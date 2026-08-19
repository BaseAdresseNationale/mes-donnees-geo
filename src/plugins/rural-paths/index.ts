import "server-only";
import { getRuralPaths as getRuralPathsFromDb } from "@/lib/db/rural-paths";
import type { RuralPath } from "@/components/rural-path/types";

export function getRuralPaths(codeCommune: string): Promise<RuralPath[]> {
  return getRuralPathsFromDb(codeCommune);
}
