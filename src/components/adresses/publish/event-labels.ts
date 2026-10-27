import type {
  Event,
  SerializedNumero,
  SerializedToponyme,
  SerializedVoie,
} from "@/lib/api-bal/generated/types.gen";

export type EventAction = Event["action"];

export const ACTION_GROUPS: { action: EventAction; label: string }[] = [
  { action: "CREATE", label: "Créations" },
  { action: "UPDATE", label: "Modifications" },
  { action: "DELETE", label: "Suppressions" },
];

const ENTITY_LABELS: Record<Event["entityType"], [string, string]> = {
  voie: ["voie", "voies"],
  toponyme: ["toponyme", "toponymes"],
  numero: ["numéro", "numéros"],
  position: ["position", "positions"],
};

// Libellé d'un événement principal, à partir de l'état après (ou avant pour
// une suppression). `voieNames` sert à nommer la voie d'un numéro.
export function eventTitle(
  event: Event,
  voieNames: Record<string, string>,
): string {
  const payload = event.payloadAfter ?? event.payloadBefore;
  switch (event.entityType) {
    case "voie":
      return `Voie « ${(payload as SerializedVoie | null)?.nom ?? "?"} »`;
    case "toponyme":
      return `Toponyme « ${(payload as SerializedToponyme | null)?.nom ?? "?"} »`;
    case "numero": {
      const numero = payload as SerializedNumero | null;
      if (!numero) return "Numéro";
      const label = [numero.numero, numero.suffixe].filter(Boolean).join(" ");
      const voie = voieNames[numero.voieId] ?? "voie supprimée";
      return `${label} — ${voie}`;
    }
    default:
      return "Position";
  }
}

// Détail : éléments liés (ex. « + 8 numéros ») ou modification limitée aux
// positions
export function eventDetail(event: Event): string | null {
  const children = event.childEvents ?? [];
  if (children.length === 0) return null;

  const counts = new Map<Event["entityType"], number>();
  for (const child of children) {
    counts.set(child.entityType, (counts.get(child.entityType) ?? 0) + 1);
  }
  const parts = [...counts].map(([type, count]) => {
    const [singular, plural] = ENTITY_LABELS[type];
    return `${count} ${count > 1 ? plural : singular}`;
  });
  return `+ ${parts.join(", ")}`;
}

export function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Message d'erreur renvoyé par mes-adresses-api (erreurs de publication
// renvoyées en 500 avec le message dans le corps)
export function apiErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const message = (error as { message?: unknown }).message;
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message) && typeof message[0] === "string") {
    return message[0];
  }
  return null;
}
