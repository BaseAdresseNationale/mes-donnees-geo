"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Input,
  Pagination,
  usePagination,
} from "@gouvfr-lasuite/ui-components";
import { IconLinkButton } from "@/components/adresses/detail/IconLinkButton";
import { normalizeSearch, type NameListItem } from "./name-list.utils";
import styles from "./NameList.module.css";

export const NAME_LIST_PAGE_SIZE = 20;

interface NameListProps {
  items: NameListItem[];
  label: string;
  // Champ de recherche affiché seulement si fourni
  searchLabel?: string;
  emptyMessage?: string;
  // Si fourni, chaque élément est un lien vers {hrefPrefix}/{id}
  hrefPrefix?: string;
  // false : tous les éléments sur une seule page, sans pagination
  paginated?: boolean;
  // Si fourni, bouton « ajouter » à droite de la recherche
  addHref?: string;
  addLabel?: string;
}

// Liste de noms inspirée de RuralPathList (recherche + cartes), paginée côté
// front puisque l'API renvoie la liste complète.
export function NameList({
  items,
  label,
  searchLabel,
  emptyMessage = "Aucun élément dans cette BAL.",
  hrefPrefix,
  paginated = true,
  addHref,
  addLabel = "Ajouter",
}: NameListProps) {
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

  const pageItems = paginated
    ? filteredItems.slice((page - 1) * pageSize, page * pageSize)
    : filteredItems;

  return (
    <section className={styles.container} aria-label={label}>
      {searchLabel && (
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
          {addHref && (
            <IconLinkButton href={addHref} label={addLabel} icon="add" />
          )}
        </div>
      )}

      {filteredItems.length === 0 ? (
        <p className={styles.empty}>
          {items.length === 0
            ? emptyMessage
            : "Aucun résultat pour cette recherche."}
        </p>
      ) : (
        <ul className={styles.list}>
          {pageItems.map((item) => (
            <li key={item.id}>
              {hrefPrefix ? (
                <Link
                  href={`${hrefPrefix}/${item.id}`}
                  className={`${styles.item} ${styles.itemLink}`}
                >
                  <span className={styles.itemTitle}>{item.nom}</span>
                </Link>
              ) : (
                <div className={styles.item}>
                  <span className={styles.itemTitle}>{item.nom}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {paginated && pagesCount !== undefined && pagesCount > 1 && (
        <div className={styles.pagination}>
          <Pagination {...pagination} displayGoto={false} />
        </div>
      )}
    </section>
  );
}
