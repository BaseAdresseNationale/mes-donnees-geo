// Onglet d'une BAL déduit de l'URL /{codeCommune}/adresses/{balId}[/voies|/toponymes][/…]
// (les sous-pages, ex. /voies/{voieId}, restent dans leur onglet)
export type BalTab = "commune" | "voies" | "toponymes";

export function getBalTab(pathname: string): BalTab {
  if (/\/voies(\/|$)/.test(pathname)) return "voies";
  if (/\/toponymes(\/|$)/.test(pathname)) return "toponymes";
  return "commune";
}

// Page de retour d'un formulaire de création / modification (URL en /new ou
// /edit), null hors formulaire. Les numéros n'ont pas de page propre : leur
// formulaire ramène à la voie.
//   …/voies/new                       → …/voies
//   …/voies/{voieId}/edit             → …/voies/{voieId}
//   …/voies/{voieId}/numeros/new      → …/voies/{voieId}
//   …/voies/{voieId}/numeros/{id}/edit → …/voies/{voieId}
export function getFormBackHref(pathname: string): string | null {
  const match = pathname.match(/^(.*)\/(?:new|edit)$/);
  if (!match) return null;
  return match[1].replace(/\/numeros(\/[^/]+)?$/, "");
}
