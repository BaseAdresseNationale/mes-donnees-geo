"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Input,
  Pagination,
  usePagination,
} from "@gouvfr-lasuite/ui-components";
import { IconLinkButton } from "@/components/adresses/detail/IconLinkButton";
import { normalizeSearch, type NameListItem } from "./name-list.utils";
import { useDeleteItem, type DeleteKind } from "./useDeleteItem";
import styles from "./NameList.module.css";

export const NAME_LIST_PAGE_SIZE = 20;

interface NameListProps {
  items: NameListItem[];
  label: string;
  // Champ de recherche affiché seulement si fourni
  searchLabel?: string;
  emptyMessage?: string;
  // Si fourni, chaque élément est un lien vers {hrefPrefix}/{id}{hrefSuffix}
  hrefPrefix?: string;
  hrefSuffix?: string;
  // false : tous les éléments sur une seule page, sans pagination
  paginated?: boolean;
  // Si fourni, bouton « ajouter » à droite de la recherche
  addHref?: string;
  addLabel?: string;
  // Si fourni, bouton « supprimer » sur chaque ligne
  deletable?: { balId: string; kind: DeleteKind };
}

// Liste de noms inspirée de RuralPathList (recherche + cartes), paginée côté
// front puisque l'API renvoie la liste complète.
export function NameList({
  items,
  label,
  searchLabel,
  emptyMessage = "Aucun élément dans cette BAL.",
  hrefPrefix,
  hrefSuffix = "",
  paginated = true,
  addHref,
  addLabel = "Ajouter",
  deletable,
}: NameListProps) {
  const [query, setQuery] = useState("");
  const {
    remove: removeItem,
    deletingId,
    error: deleteError,
  } = useDeleteItem(deletable?.balId ?? "", deletable?.kind ?? "numero");

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

      {deleteError && (
        <p className={styles.error} role="alert">
          {deleteError}
        </p>
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
            <li key={item.id} className={styles.row}>
              {hrefPrefix ? (
                <Link
                  href={`${hrefPrefix}/${item.id}${hrefSuffix}`}
                  className={`${styles.itemContent} ${styles.itemLink}`}
                >
                  <span className={styles.itemTitle}>{item.nom}</span>
                </Link>
              ) : (
                <div className={styles.itemContent}>
                  <span className={styles.itemTitle}>{item.nom}</span>
                </div>
              )}
              {deletable && (
                <Button
                  type="button"
                  variant="tertiary"
                  color="neutral"
                  size="small"
                  icon={<span className="material-icons">delete</span>}
                  aria-label={`Supprimer ${item.nom}`}
                  title="Supprimer"
                  onClick={() => removeItem(item.id, item.nom)}
                  disabled={deletingId !== null}
                />
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
