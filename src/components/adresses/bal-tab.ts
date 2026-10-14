// Onglet d'une BAL déduit de l'URL /{codeCommune}/adresses/{balId}[/voies|/toponymes]
export type BalTab = "commune" | "voies" | "toponymes";

export function getBalTab(pathname: string): BalTab {
  if (pathname.endsWith("/voies")) return "voies";
  if (pathname.endsWith("/toponymes")) return "toponymes";
  return "commune";
}
