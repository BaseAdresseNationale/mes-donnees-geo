export interface NameListItem {
  id: string;
  nom: string;
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
