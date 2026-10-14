import type { Numero } from "./generated/types.gen";

// Numéros triés par nom de voie, puis numéro, puis suffixe (les numéros d'un
// toponyme arrivent de l'API sans ordre particulier, avec leur voie)
export function compareNumerosByVoie(a: Numero, b: Numero): number {
  return (
    (a.voie?.nom ?? "").localeCompare(b.voie?.nom ?? "", "fr") ||
    a.numero - b.numero ||
    (a.suffixe ?? "").localeCompare(b.suffixe ?? "", "fr")
  );
}
