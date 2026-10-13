"use client";

import { useEffect, useMemo, useState } from "react";
import { DataGrid, Input, usePagination } from "@gouvfr-lasuite/ui-components";
import { normalizeSearch, type NameListItem } from "./name-list.utils";
import styles from "./NameList.module.css";

export const NAME_LIST_PAGE_SIZE = 20;

export const NAME_LIST_COLUMNS = [{ field: "nom" }];

interface NameListProps {
  items: NameListItem[];
  label: string;
  searchLabel: string;
}

// Équivalent du DataList de l'ui-kit (pas d'en-tête ni de tri), avec en plus
// la pagination intégrée au DataGrid. La liste complète est paginée côté front.
export function NameList({ items, label, searchLabel }: NameListProps) {
  const [query, setQuery] = useState("");

  // Recherche par nom sur la liste complète, avant pagination
  const filteredItems = useMemo(() => {
    const search = normalizeSearch(query);
    if (!search) return items;
    return items.filter((item) => normalizeSearch(item.nom).includes(search));
  }, [items, query]);

  const pagination = usePagination({ pageSize: NAME_LIST_PAGE_SIZE });
  const { page, setPage, setPagesCount, pageSize } = pagination;

  useEffect(() => {
    setPagesCount(Math.max(1, Math.ceil(filteredItems.length / pageSize)));
    setPage(1);
  }, [filteredItems, pageSize, setPage, setPagesCount]);

  const pageItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);

  return (
    <section className={styles.container} aria-label={label}>
      <div className={styles.search}>
        <Input
          label={searchLabel}
          fullWidth
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          icon={<span className="material-icons">search</span>}
        />
      </div>
      <DataGrid
        columns={NAME_LIST_COLUMNS}
        rows={pageItems}
        className={styles.grid}
        pagination={pagination}
        displayHeader={false}
        enableSorting={false}
        emptyPlaceholderLabel="Aucun résultat pour cette recherche."
        hideEmptyPlaceholderImage
      />
    </section>
  );
}
