import type { CSSProperties } from "react";
import listStyles from "@/components/adresses/list/NameList.module.css";
import styles from "@/components/adresses/form/form.module.css";

// Barre animée de la taille d'un élément du formulaire
function Bar({ style }: { style: CSSProperties }) {
  return <div className={listStyles.skeleton} style={style} />;
}

// Hauteurs approchant celles des champs de l'ui-kit
const FIELD = { width: "100%", height: "3rem" };
const LEGEND = { width: "9rem", height: "1rem" };
const HINT = { width: "85%", height: "0.875rem" };
const BUTTON = { width: "13rem", height: "2rem" };

function Chips({ widths }: { widths: number[] }) {
  return (
    <div className={styles.chips}>
      {widths.map((width, index) => (
        <Bar
          key={index}
          style={{ width: `${width}rem`, height: "1.5rem", borderRadius: 999 }}
        />
      ))}
    </div>
  );
}

// Skeleton du formulaire de toponyme : nom, langues régionales, positions,
// numéros associés, parcelles et actions, dans l'ordre du formulaire.
export function ToponymeFormSkeleton() {
  return (
    <div
      className={styles.form}
      aria-busy="true"
      aria-label="Chargement du formulaire"
    >
      <Bar style={{ width: "50%", height: "1.25rem" }} />
      <Bar style={FIELD} />

      <div className={styles.fieldset}>
        <Bar style={LEGEND} />
        <Bar style={BUTTON} />
      </div>

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
        <Chips widths={[8, 9, 7.5, 8.5]} />
        <Bar style={{ ...BUTTON, width: "17rem" }} />
      </div>

      <div className={styles.fieldset}>
        <Bar style={LEGEND} />
        <Bar style={HINT} />
        <Chips widths={[7.5, 8]} />
      </div>

      <div className={styles.actions}>
        <Bar style={{ width: "5.5rem", height: "2.5rem" }} />
        <Bar style={{ width: "7.5rem", height: "2.5rem" }} />
      </div>
    </div>
  );
}
