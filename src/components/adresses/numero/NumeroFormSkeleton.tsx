import type { CSSProperties } from "react";
import listStyles from "@/components/adresses/list/NameList.module.css";
import styles from "./NumeroForm.module.css";

// Barre animée de la taille d'un élément du formulaire
function Bar({ style }: { style: CSSProperties }) {
  return <div className={listStyles.skeleton} style={style} />;
}

// Hauteurs approchant celles des champs de l'ui-kit
const FIELD = { width: "100%", height: "3rem" };
const LEGEND = { width: "9rem", height: "1rem" };
const HINT = { width: "85%", height: "0.875rem" };
const BUTTON = { width: "11rem", height: "2rem" };

// Skeleton du formulaire de numéro : reprend sa mise en page (numéro +
// suffixe, toponyme, positions, parcelles, commentaire, actions) pour que
// rien ne bouge à l'arrivée des données.
export function NumeroFormSkeleton() {
  return (
    <div
      className={styles.form}
      aria-busy="true"
      aria-label="Chargement du formulaire"
    >
      <Bar style={{ width: "55%", height: "1.25rem" }} />

      <div className={styles.row}>
        <div className={styles.numero}>
          <Bar style={FIELD} />
        </div>
        <div className={styles.suffixe}>
          <Bar style={FIELD} />
        </div>
      </div>

      <Bar style={FIELD} />

      <div className={styles.fieldset}>
        <Bar style={LEGEND} />
        <Bar style={HINT} />
        <div className={styles.positionRow}>
          <div className={styles.positionType}>
            <Bar style={FIELD} />
          </div>
          <Bar style={{ width: "7rem", height: "0.875rem" }} />
          <Bar style={{ width: "2rem", height: "2rem" }} />
        </div>
        <Bar style={BUTTON} />
      </div>

      <div className={styles.fieldset}>
        <Bar style={LEGEND} />
        <Bar style={HINT} />
        <div className={styles.parcelles}>
          {[7.5, 8, 7].map((width, index) => (
            <Bar
              key={index}
              style={{
                width: `${width}rem`,
                height: "1.5rem",
                borderRadius: 999,
              }}
            />
          ))}
        </div>
      </div>

      <Bar style={{ width: "100%", height: "5.5rem" }} />

      <div className={styles.actions}>
        <Bar style={{ width: "5.5rem", height: "2.5rem" }} />
        <Bar style={{ width: "7.5rem", height: "2.5rem" }} />
      </div>
    </div>
  );
}
