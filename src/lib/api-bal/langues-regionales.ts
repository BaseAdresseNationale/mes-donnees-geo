// Langues régionales acceptées par mes-adresses-api pour nomAlt.
// Copie de @ban-team/shared-data/langues-regionales.json (v1.4.3), la liste
// utilisée par la validation de l'API.
export const LANGUES_REGIONALES = [
  { code: "fra", label: "français" },
  { code: "bre", label: "breton" },
  { code: "eus", label: "basque" },
  { code: "gsw", label: "alsacien" },
  { code: "cos", label: "corse" },
  { code: "gcr", label: "créole-guyanais" },
  { code: "gcf", label: "créole-martiniquais-guadeloupéen" },
  { code: "rcf", label: "créole-réunionnais" },
  { code: "swb", label: "mahorais" },
  { code: "oci", label: "occitan" },
  { code: "cat", label: "catalan" },
  { code: "pcd", label: "picard" },
  { code: "oc-provenc", label: "provençal" },
  { code: "oc-nicard", label: "niçard" },
  { code: "vls", label: "flamand" },
  { code: "fr-gallo", label: "gallo" },
  { code: "aji", label: "ajië" },
  { code: "dhv", label: "drehu" },
  { code: "nen", label: "nengone" },
  { code: "pri", label: "paicî" },
  { code: "ty", label: "tahitien" },
  { code: "mrq", label: "marquisien" },
  { code: "pmt", label: "Paumotu" },
  { code: "mrv", label: "mangarévien" },
  { code: "frp", label: "francoprovençal" },
] as const;

export function getLangueLabel(code: string): string {
  return (
    LANGUES_REGIONALES.find((langue) => langue.code === code)?.label ?? code
  );
}
