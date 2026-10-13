"use client";

import { DataList, Input } from "@gouvfr-lasuite/ui-components";
import { NAME_LIST_PAGE_SIZE } from "./NameList";
import styles from "./NameList.module.css";

// Lignes de la grille ui-kit, avec une barre animée à la place du nom.
// Largeurs variées pour imiter des noms de longueurs différentes.
const PLACEHOLDER_ROWS = Array.from(
  { length: NAME_LIST_PAGE_SIZE },
  (_, i) => ({
    id: String(i),
    width: `${45 + ((i * 37) % 45)}%`,
  }),
);

const SKELETON_COLUMNS = [
  {
    field: "nom",
    renderCell: ({ row }: { row: (typeof PLACEHOLDER_ROWS)[number] }) => (
      <div className={styles.skeleton} style={{ width: row.width }} />
    ),
  },
];

export function NameListSkeleton({ searchLabel }: { searchLabel: string }) {
  return (
    <section
      className={styles.container}
      aria-busy="true"
      aria-label="Chargement de la liste"
    >
      {/* Même champ que NameList, désactivé : la mise en page ne bouge pas */}
      <div className={styles.search}>
        <Input
          label={searchLabel}
          fullWidth
          disabled
          icon={<span className="material-icons">search</span>}
        />
      </div>
      <DataList
        columns={SKELETON_COLUMNS}
        rows={PLACEHOLDER_ROWS}
        className={styles.grid}
      />
    </section>
  );
}
