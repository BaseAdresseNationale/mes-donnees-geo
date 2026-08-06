import Link from "next/link";

const MESSAGES: Record<string, string> = {
  transient_missing: "Session d'authentification introuvable ou expirée. Merci de recommencer.",
  missing_sub: "Le fournisseur d'identité n'a pas retourné d'identifiant utilisateur.",
  oidc_exchange_failed: "L'échange avec ProConnect a échoué.",
  missing_siret:
    "Votre profil ProConnect ne contient pas de SIRET. Impossible d'identifier votre commune.",
  siret_resolution_failed: "Impossible de résoudre le SIRET auprès du répertoire des entreprises.",
  not_a_commune:
    "Accès réservé aux communes. L'organisation rattachée à votre profil ProConnect n'est pas identifiée comme une commune (catégorie juridique 7210).",
};

export const metadata = {
  title: "Erreur d'authentification",
};

export default async function ErreurPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; detail?: string }>;
}) {
  const { code, detail } = await searchParams;
  const message = (code && MESSAGES[code]) ?? "Une erreur inconnue est survenue.";
  return (
    <main id="contenu" style={{ padding: "2rem", maxWidth: "640px", margin: "0 auto" }}>
      <h1>Connexion refusée</h1>
      <p>{message}</p>
      {detail && (
        <details>
          <summary>Détails techniques</summary>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.875rem" }}>{detail}</pre>
        </details>
      )}
      <p style={{ marginTop: "2rem" }}>
        <Link href="/">Retour à l&apos;accueil</Link>
      </p>
    </main>
  );
}
