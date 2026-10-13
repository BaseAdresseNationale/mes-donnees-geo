"use client";

import { useEffect } from "react";
import { DataGrid, usePagination } from "@gouvfr-lasuite/ui-components";
import type { NameListItem } from "./name-list.utils";
import styles from "./NameList.module.css";

export const NAME_LIST_PAGE_SIZE = 20;

export const NAME_LIST_COLUMNS = [{ field: "nom" }];

interface NameListProps {
  items: NameListItem[];
  label: string;
  emptyMessage: string;
}

// Équivalent du DataList de l'ui-kit (pas d'en-tête ni de tri), avec en plus
// la pagination intégrée au DataGrid. La liste complète est paginée côté front.
export function NameList({ items, label, emptyMessage }: NameListProps) {
  const pagination = usePagination({ pageSize: NAME_LIST_PAGE_SIZE });
  const { page, setPage, setPagesCount, pageSize } = pagination;

  useEffect(() => {
    setPagesCount(Math.max(1, Math.ceil(items.length / pageSize)));
    setPage(1);
  }, [items, pageSize, setPage, setPagesCount]);

  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);

  return (
    <section className={styles.container} aria-label={label}>
      <DataGrid
        columns={NAME_LIST_COLUMNS}
        rows={pageItems}
        className={styles.grid}
        pagination={pagination}
        displayHeader={false}
        enableSorting={false}
        emptyPlaceholderLabel={emptyMessage}
        hideEmptyPlaceholderImage
      />
    </section>
  );
}
