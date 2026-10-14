import listStyles from "@/components/adresses/list/NameList.module.css";
import styles from "./DetailHeader.module.css";

// Mêmes dimensions que DetailHeader pendant le chargement
export function DetailHeaderSkeleton() {
  return (
    <header className={styles.header} aria-hidden="true">
      <div className={`${listStyles.skeleton} ${styles.skeletonTitle}`} />
      <div className={`${listStyles.skeleton} ${styles.skeletonSubtitle}`} />
    </header>
  );
}
