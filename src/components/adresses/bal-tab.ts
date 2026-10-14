// Onglet d'une BAL déduit de l'URL /{codeCommune}/adresses/{balId}[/voies|/toponymes][/…]
// (les sous-pages, ex. /voies/{voieId}, restent dans leur onglet)
export type BalTab = "commune" | "voies" | "toponymes";

export function getBalTab(pathname: string): BalTab {
  if (/\/voies(\/|$)/.test(pathname)) return "voies";
  if (/\/toponymes(\/|$)/.test(pathname)) return "toponymes";
  return "commune";
}
