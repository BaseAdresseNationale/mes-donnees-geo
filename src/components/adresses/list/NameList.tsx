"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Input,
  Pagination,
  usePagination,
} from "@gouvfr-lasuite/ui-components";
import { normalizeSearch, type NameListItem } from "./name-list.utils";
import styles from "./NameList.module.css";

export const NAME_LIST_PAGE_SIZE = 20;

interface NameListProps {
  items: NameListItem[];
  label: string;
  searchLabel: string;
}

// Liste de noms inspirée de RuralPathList (recherche + cartes), paginée côté
// front puisque l'API renvoie la liste complète.
export function NameList({ items, label, searchLabel }: NameListProps) {
  const [query, setQuery] = useState("");

  // Recherche par nom sur la liste complète, avant pagination
  const filteredItems = useMemo(() => {
    const search = normalizeSearch(query);
    if (!search) return items;
    return items.filter((item) => normalizeSearch(item.nom).includes(search));
  }, [items, query]);

  const pagination = usePagination({ pageSize: NAME_LIST_PAGE_SIZE });
  const { page, setPage, pagesCount, setPagesCount, pageSize } = pagination;

  useEffect(() => {
    setPagesCount(Math.max(1, Math.ceil(filteredItems.length / pageSize)));
    setPage(1);
  }, [filteredItems, pageSize, setPage, setPagesCount]);

  const pageItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);

  return (
    <section className={styles.container} aria-label={label}>
      <div className={styles.search}>
        <Input
          aria-label={searchLabel}
          placeholder={searchLabel}
          hideLabel
          fullWidth
          className={styles.searchInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          icon={<span className="material-icons">search</span>}
        />
      </div>

      {filteredItems.length === 0 ? (
        <p className={styles.empty}>
          {items.length === 0
            ? "Aucun élément dans cette BAL."
            : "Aucun résultat pour cette recherche."}
        </p>
      ) : (
        <ul className={styles.list}>
          {pageItems.map((item) => (
            <li key={item.id} className={styles.item}>
              <span className={styles.itemTitle}>{item.nom}</span>
            </li>
          ))}
        </ul>
      )}

      {pagesCount !== undefined && pagesCount > 1 && (
        <div className={styles.pagination}>
          <Pagination {...pagination} displayGoto={false} />
        </div>
      )}
    </section>
  );
}
