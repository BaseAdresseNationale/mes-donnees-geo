import styles from "./NameList.module.css";

const SKELETON_ROWS = 20;

export function NameListSkeleton() {
  return (
    <section
      className={styles.container}
      aria-busy="true"
      aria-label="Chargement de la liste"
    >
      <div className={`${styles.skeleton} ${styles.skeletonCount}`} />
      <ul className={styles.list} aria-hidden="true">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <li key={index} className={styles.item}>
            <div
              className={`${styles.skeleton} ${styles.skeletonText}`}
              // Largeurs variées pour imiter des noms de longueurs différentes
              style={{ width: `${45 + ((index * 37) % 45)}%` }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
