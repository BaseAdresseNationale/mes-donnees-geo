import listStyles from "@/components/adresses/list/NameList.module.css";
import styles from "./VoieHeader.module.css";

// Mêmes dimensions que VoieHeader pendant le chargement
export function VoieHeaderSkeleton() {
  return (
    <header className={styles.header} aria-hidden="true">
      <div className={`${listStyles.skeleton} ${styles.skeletonTitle}`} />
      <div className={`${listStyles.skeleton} ${styles.skeletonSubtitle}`} />
    </header>
  );
}
