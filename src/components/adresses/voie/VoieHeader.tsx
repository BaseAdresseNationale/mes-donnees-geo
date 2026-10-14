import styles from "./VoieHeader.module.css";

interface VoieHeaderProps {
  nom: string;
  nbNumeros: number;
}

export function VoieHeader({ nom, nbNumeros }: VoieHeaderProps) {
  return (
    <header className={styles.header}>
      <h2 className={styles.title}>{nom}</h2>
      <p className={styles.subtitle}>
        {nbNumeros} numéro{nbNumeros > 1 ? "s" : ""}
      </p>
    </header>
  );
}
