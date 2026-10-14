import type { CSSProperties } from "react";
import listStyles from "@/components/adresses/list/NameList.module.css";
import styles from "@/components/adresses/form/form.module.css";

// Barre animée de la taille d'un élément du formulaire
function Bar({ style }: { style: CSSProperties }) {
  return <div className={listStyles.skeleton} style={style} />;
}

const LEGEND = { width: "9rem", height: "1rem" };

// Skeleton du formulaire de voie (création / modification) : nom, type de
// numérotation, langues régionales, commentaire et actions
export function VoieFormSkeleton() {
  return (
    <div className={styles.form} aria-busy="true" aria-label="Chargement">
      <Bar style={{ width: "40%", height: "1.25rem" }} />
      <Bar style={{ width: "100%", height: "3rem" }} />

      <div className={styles.fieldset}>
        <Bar style={LEGEND} />
        <Bar style={{ width: "8rem", height: "1.25rem" }} />
        <Bar style={{ width: "13rem", height: "1.25rem" }} />
      </div>

      <div className={styles.fieldset}>
        <Bar style={LEGEND} />
        <Bar style={{ width: "13rem", height: "2rem" }} />
      </div>

      <Bar style={{ width: "100%", height: "5.5rem" }} />

      <div className={styles.actions}>
        <Bar style={{ width: "5.5rem", height: "2.5rem" }} />
        <Bar style={{ width: "7.5rem", height: "2.5rem" }} />
      </div>
    </div>
  );
}
