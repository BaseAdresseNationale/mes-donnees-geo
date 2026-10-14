// type (et non interface) pour être compatible avec le Row de l'ui-kit
export type NameListItem = {
  id: string;
  nom: string;
};

// Forme comparable pour la recherche : sans casse ni accents
// ("Allée" et "allee" correspondent).
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .trim();
}

// Ne garde que ce qu'affiche la liste (payload minimal vers le client),
// trié par nom.
export function toNameListItems(
  entities: { id: string; nom: string }[],
): NameListItem[] {
  return entities
    .map(({ id, nom }) => ({ id, nom }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}
