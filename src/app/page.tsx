import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { isValidInseeCode } from "@/lib/geo/commune";
import styles from "./page.module.css";

export default async function HomePage() {
  const session = await getSession();
  if (session && isValidInseeCode(session.communeInsee ?? "")) {
    redirect(`/${session.communeInsee}`);
  }
  // Session absente ou périmée (schéma antérieur) → on affiche l'écran de connexion.

  return (
    <main id="contenu" className={styles.main}>
      <div className={styles.hero}>
        <h1>Mes données géo</h1>
        <p className={styles.tagline}>
          Éditez les données géographiques de votre commune : contours, chemins
          ruraux, adresses… Interface modulaire, souveraine, accessible.
        </p>
        <form action="/auth/login" method="post">
          <button type="submit" className={styles.cta}>
            Se connecter avec ProConnect
          </button>
        </form>
        <p className={styles.stubNote}>
          Mode stub actif : vous serez connecté·e sous une identité de test.
        </p>
        <p className={styles.docs}>
          <Link href="/apropos">À propos de l&apos;outil</Link>
        </p>
      </div>
    </main>
  );
}
