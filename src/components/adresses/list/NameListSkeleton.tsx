"use client";

import { Input } from "@gouvfr-lasuite/ui-components";
import { NAME_LIST_PAGE_SIZE } from "./NameList";
import styles from "./NameList.module.css";

export function NameListSkeleton({ searchLabel }: { searchLabel?: string }) {
  return (
    <section
      className={styles.container}
      aria-busy="true"
      aria-label="Chargement de la liste"
    >
      {/* Même champ que NameList, désactivé : la mise en page ne bouge pas */}
      {searchLabel && (
        <div className={styles.search}>
          <Input
            aria-label={searchLabel}
            placeholder={searchLabel}
            hideLabel
            fullWidth
            disabled
            className={styles.searchInput}
            icon={<span className="material-icons">search</span>}
          />
        </div>
      )}
      <ul className={styles.list} aria-hidden="true">
        {Array.from({ length: NAME_LIST_PAGE_SIZE }, (_, index) => (
          <li key={index} className={styles.item}>
            <div
              className={styles.skeleton}
              // Largeurs variées pour imiter des noms de longueurs différentes
              style={{ width: `${45 + ((index * 37) % 45)}%` }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
