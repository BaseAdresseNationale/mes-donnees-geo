export const IMPORT_ALGORITHMS = ["legacy", "buffer", "graph"] as const;

export type ImportAlgorithm = (typeof IMPORT_ALGORITHMS)[number];

export const DEFAULT_IMPORT_ALGORITHM: ImportAlgorithm = "legacy";

export const IMPORT_ALGORITHM_LABELS: Record<
  ImportAlgorithm,
  { label: string; description: string }
> = {
  legacy: {
    label: "Historique (tronçon par tronçon)",
    description:
      "Découpe chaque tronçon BD TOPO au couloir cadastral, chaîne les portions et comble les trous par des segments manuels.",
  },
  buffer: {
    label: "Couverture par buffer",
    description:
      "Retient les tronçons BD TOPO entiers situés à plus de 80 % dans le couloir cadastral, et valide la voie si 80 % du filaire cadastral est couvert.",
  },
  graph: {
    label: "Map matching sur graphe",
    description:
      "Construit le graphe BD TOPO autour du filaire cadastral et retient le meilleur chemin connexe (plus court chemin pénalisé hors couloir).",
  },
};

export function isImportAlgorithm(value: unknown): value is ImportAlgorithm {
  return (
    typeof value === "string" &&
    (IMPORT_ALGORITHMS as readonly string[]).includes(value)
  );
}
