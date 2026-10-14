import listStyles from "@/components/adresses/list/NameList.module.css";
import styles from "@/components/adresses/form/form.module.css";

// Skeleton du formulaire de voie (création / modification)
export function VoieFormSkeleton() {
  return (
    <div className={styles.form} aria-busy="true" aria-label="Chargement">
      {[40, 100, 100, 100].map((width, index) => (
        <div
          key={index}
          className={listStyles.skeleton}
          style={{
            width: `${width}%`,
            height: index === 0 ? "1.25rem" : "3rem",
          }}
        />
      ))}
    </div>
  );
}
