import styles from "./DetailHeader.module.css";

interface DetailHeaderProps {
  nom: string;
  nbNumeros: number;
}

// En-tête des pages voie / toponyme : nom et nombre de numéros
export function DetailHeader({ nom, nbNumeros }: DetailHeaderProps) {
  return (
    <header className={styles.header}>
      <h2 className={styles.title}>{nom}</h2>
      <p className={styles.subtitle}>
        {nbNumeros} numéro{nbNumeros > 1 ? "s" : ""}
      </p>
    </header>
  );
}
