import { IconLinkButton } from "./IconLinkButton";
import styles from "./DetailHeader.module.css";

interface DetailHeaderProps {
  nom: string;
  nbNumeros: number;
  // Si fourni, bouton « modifier » à droite du nom
  editHref?: string;
  editLabel?: string;
}

// En-tête des pages voie / toponyme : nom et nombre de numéros
export function DetailHeader({
  nom,
  nbNumeros,
  editHref,
  editLabel = "Modifier",
}: DetailHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <h2 className={styles.title}>{nom}</h2>
        {editHref && (
          <IconLinkButton href={editHref} label={editLabel} icon="edit" />
        )}
      </div>
      <p className={styles.subtitle}>
        {nbNumeros} numéro{nbNumeros > 1 ? "s" : ""}
      </p>
    </header>
  );
}
