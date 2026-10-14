import { NameList } from "@/components/adresses/list/NameList";
import type { NameListItem } from "@/components/adresses/list/name-list.utils";
import styles from "./NumerosByVoie.module.css";

export interface VoieNumeros {
  voieId: string;
  voieNom: string;
  numeros: NameListItem[];
}

// Numéros regroupés par voie : nom de la voie et nombre de numéros, puis la
// liste de ses numéros. Seul l'ensemble défile.
export function NumerosByVoie({
  balId,
  voies,
  emptyMessage,
}: {
  // BAL des numéros (bouton « archiver » sur chaque numéro)
  balId: string;
  voies: VoieNumeros[];
  emptyMessage: string;
}) {
  if (voies.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  return (
    <div className={styles.groups}>
      {voies.map(({ voieId, voieNom, numeros }) => (
        <section key={voieId} aria-labelledby={`voie-${voieId}`}>
          <header className={styles.header}>
            <h3 id={`voie-${voieId}`} className={styles.title}>
              {voieNom}
            </h3>
            <span className={styles.count}>
              {numeros.length} numéro{numeros.length > 1 ? "s" : ""}
            </span>
          </header>
          <NameList
            items={numeros}
            label={`Numéros de ${voieNom}`}
            paginated={false}
            archive={{ balId, kind: "numero" }}
          />
        </section>
      ))}
    </div>
  );
}
