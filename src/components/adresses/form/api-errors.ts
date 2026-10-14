// Erreurs de validation de mes-adresses-api (400) : body.message[] au format
// "champ_api:message". `fields` associe le préfixe API au champ du formulaire.
// Renvoie null si aucune erreur ne correspond à un champ connu.
export function parseApiFieldErrors<Field extends string>(
  error: unknown,
  fields: Record<string, Field>,
): Partial<Record<Field, string>> | null {
  const messages =
    error && typeof error === "object" && "message" in error
      ? error.message
      : null;
  if (!Array.isArray(messages)) return null;

  const errors: Partial<Record<Field, string>> = {};
  for (const message of messages) {
    if (typeof message !== "string") continue;
    const [prefix, ...rest] = message.split(":");
    const field = fields[prefix];
    if (field && rest.length > 0) errors[field] = rest.join(":").trim();
  }
  return Object.keys(errors).length > 0 ? errors : null;
}
