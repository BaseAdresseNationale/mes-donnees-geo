import "server-only";
import { getLocalPaths as getLocalPathsFromDb } from "@/lib/db/voies-locales";

import type { LocalPath } from "@/components/voies-locales/types";

export function getLocalPaths(codeCommune: string): Promise<LocalPath[]> {
  return getLocalPathsFromDb(codeCommune);
}
