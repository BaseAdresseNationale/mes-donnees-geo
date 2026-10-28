"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Input,
  Pagination,
  usePagination,
} from "@gouvfr-lasuite/ui-components";
import { IconLinkButton } from "@/components/adresses/detail/IconLinkButton";
import { normalizeSearch, type NameListItem } from "./name-list.utils";
import { useDeleteItem, type DeleteKind } from "./useDeleteItem";
import {
  useListMemory,
  type ListMemoryKey,
} from "@/components/adresses/navigation";
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
  // Si fourni, la recherche, la page et le dernier élément consulté sont
  // retrouvés en revenant sur la liste (élément centré et mis en évidence)
  memoryKey?: ListMemoryKey;
}

function filterItems(items: NameListItem[], query: string): NameListItem[] {
  const search = normalizeSearch(query);
  if (!search) return items;
  return items.filter((item) => normalizeSearch(item.nom).includes(search));
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
  memoryKey,
}: NameListProps) {
  const listMemory = useListMemory(memoryKey);
  // État restauré au montage : recherche mémorisée, et page du dernier
  // élément consulté (à défaut, page mémorisée)
  const [initial] = useState(() => {
    const { query, page, selectedId } = listMemory.get();
    const filtered = filterItems(items, query);
    const pagesCount = Math.max(
      1,
      Math.ceil(filtered.length / NAME_LIST_PAGE_SIZE),
    );
    const selectedIndex = filtered.findIndex((item) => item.id === selectedId);
    return {
      query,
      selectedId,
      pagesCount,
      page:
        selectedIndex >= 0
          ? Math.floor(selectedIndex / NAME_LIST_PAGE_SIZE) + 1
          : Math.min(page, pagesCount),
    };
  });
  const [query, setQuery] = useState(initial.query);
  const selectedRowRef = useRef<HTMLLIElement>(null);
  const {
    remove: removeItem,
    deletingId,
    error: deleteError,
  } = useDeleteItem(deletable?.balId ?? "", deletable?.kind ?? "numero");

  // Recherche par nom sur la liste complète, avant pagination
  const filteredItems = useMemo(
    () => filterItems(items, query),
    [items, query],
  );

  const pagination = usePagination({
    pageSize: NAME_LIST_PAGE_SIZE,
    defaultPage: initial.page,
    defaultPagesCount: initial.pagesCount,
  });
  const { page, setPage, pagesCount, setPagesCount, pageSize } = pagination;

  // La page courante est gardée (page restaurée au montage), ramenée au
  // nombre de pages si la liste a raccourci (ex. après une suppression).
  // C'est la saisie d'une recherche qui ramène à la première page.
  useEffect(() => {
    const count = Math.max(1, Math.ceil(filteredItems.length / pageSize));
    setPagesCount(count);
    setPage((current) => Math.min(current, count));
  }, [filteredItems, pageSize, setPage, setPagesCount]);

  useEffect(() => {
    listMemory.save({ query, page });
  }, [listMemory, query, page]);

  // Dernier élément consulté centré dans la liste au montage
  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: "center" });
  }, []);

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
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
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
          {pageItems.map((item) => {
            const isSelected = item.id === initial.selectedId;
            return (
              <li
                key={item.id}
                ref={isSelected ? selectedRowRef : undefined}
                className={`${styles.row} ${isSelected ? styles.rowSelected : ""}`}
                aria-current={isSelected ? "true" : undefined}
              >
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
            );
          })}
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
