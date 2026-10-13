"use client";

import { useEffect } from "react";
import { Pagination, usePagination } from "@gouvfr-lasuite/ui-components";
import type { NameListItem } from "./name-list.utils";
import styles from "./NameList.module.css";

export const NAME_LIST_PAGE_SIZE = 20;

interface NameListProps {
  items: NameListItem[];
  label: string;
  singular: string;
  plural: string;
  emptyMessage: string;
}

export function NameList({
  items,
  label,
  singular,
  plural,
  emptyMessage,
}: NameListProps) {
  const pagination = usePagination({ pageSize: NAME_LIST_PAGE_SIZE });
  const { page, setPage, pagesCount, setPagesCount, pageSize } = pagination;

  useEffect(() => {
    setPagesCount(Math.max(1, Math.ceil(items.length / pageSize)));
    setPage(1);
  }, [items, pageSize, setPage, setPagesCount]);

  if (items.length === 0) {
    return (
      <section className={styles.container} aria-label={label}>
        <p className={styles.empty}>{emptyMessage}</p>
      </section>
    );
  }

  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);

  return (
    <section className={styles.container} aria-label={label}>
      <p className={styles.count}>
        {items.length} {items.length > 1 ? plural : singular}
      </p>
      <ul className={styles.list}>
        {pageItems.map((item) => (
          <li key={item.id} className={styles.item}>
            {item.nom}
          </li>
        ))}
      </ul>
      {pagesCount !== undefined && pagesCount > 1 && (
        <div className={styles.pagination}>
          <Pagination {...pagination} />
        </div>
      )}
    </section>
  );
}
