"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  Button,
  DropdownMenu,
  DropdownMenuItem,
  Input,
  useDropdownMenu,
} from "@gouvfr-lasuite/ui-components";
import styles from "./LeftPanelList.module.css";

export interface LeftPanelSortOption<T> {
  key: string;
  label: string;
  comparator: (a: T, b: T) => number;
}

export interface LeftPanelFilter<T> {
  /** Vrai si au moins un filtre est actif (change l'apparence du bouton). */
  isActive: boolean;
  /** Prédicat appliqué à chaque élément pour le conserver ou non. */
  matches: (item: T) => boolean;
  ariaLabel?: string;
  /** Rend la modale de filtre, pilotée par l'ouverture/fermeture interne. */
  renderModal: (ctx: { isOpen: boolean; onClose: () => void }) => ReactNode;
}

export interface LeftPanelSelection {
  selectedKeys: Set<string>;
  onToggle: (key: string) => void;
  /** Reçoit les clés des éléments actuellement visibles (filtrés + triés). */
  onSelectAll: (visibleKeys: string[]) => void;
  onClear: () => void;
}

export interface LeftPanelItemContext {
  selected: boolean;
  toggle: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export interface LeftPanelListProps<T> {
  ariaLabel: string;
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T, ctx: LeftPanelItemContext) => ReactNode;

  /** Prédicat de recherche texte. Si omis, la barre de recherche est masquée. */
  matchesQuery?: (item: T, normalizedQuery: string) => boolean;
  searchAriaLabel?: string;

  /** Options de tri. Si omis, le bouton de tri est masqué. */
  sortOptions?: LeftPanelSortOption<T>[];
  sortAriaLabel?: string;

  filter?: LeftPanelFilter<T>;

  selection?: LeftPanelSelection;
  /** Restreint "Tout sélectionner" aux éléments pour lesquels le prédicat est vrai. */
  isSelectable?: (item: T) => boolean;
  onHoverChange?: (key: string | null) => void;

  /** Notifie le parent de la liste visible (filtrée + triée), p.ex. pour la carte. */
  onVisibleItemsChange?: (items: T[]) => void;

  emptyMessage: ReactNode;
  noResultsMessage: ReactNode;

  header?: ReactNode;
  footer?: ReactNode;

  /** `inline` : s'intègre dans un conteneur déjà scrollable (sans padding ni hauteur imposée). */
  variant?: "panel" | "inline";
}

export function LeftPanelList<T>({
  ariaLabel,
  items,
  getKey,
  renderItem,
  matchesQuery,
  searchAriaLabel = "Rechercher",
  sortOptions,
  sortAriaLabel = "Trier",
  filter,
  selection,
  isSelectable,
  onHoverChange,
  onVisibleItemsChange,
  emptyMessage,
  noResultsMessage,
  header,
  footer,
  variant = "panel",
}: LeftPanelListProps<T>) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const { isOpen: isSortMenuOpen, setIsOpen: setIsSortMenuOpen } =
    useDropdownMenu();

  const sortMenuOptions: DropdownMenuItem[] = useMemo(
    () =>
      (sortOptions ?? []).map((option) => ({
        id: option.key,
        label: option.label,
        isChecked: sortKey === option.key,
        callback: () => setSortKey(option.key),
      })),
    [sortOptions, sortKey],
  );

  const activeSort = useMemo(
    () => sortOptions?.find((option) => option.key === sortKey) ?? null,
    [sortOptions, sortKey],
  );

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const result = items.filter((item) => {
      if (filter && !filter.matches(item)) return false;
      if (!normalizedQuery || !matchesQuery) return true;
      return matchesQuery(item, normalizedQuery);
    });
    if (!activeSort) return result;
    return [...result].sort(activeSort.comparator);
  }, [items, query, filter, matchesQuery, activeSort]);

  useEffect(() => {
    onVisibleItemsChange?.(visibleItems);
  }, [visibleItems, onVisibleItemsChange]);

  const selectableItems = useMemo(
    () => (isSelectable ? visibleItems.filter(isSelectable) : visibleItems),
    [visibleItems, isSelectable],
  );

  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  useEffect(() => {
    onHoverChange?.(hoveredKey);
  }, [hoveredKey, onHoverChange]);

  return (
    <section
      className={`${styles.container} ${variant === "inline" ? styles.inline : ""}`}
      aria-label={ariaLabel}
    >
      {header}

      {(matchesQuery || sortOptions || filter || selection) && (
        <div className={styles.toolbar}>
          {(matchesQuery || sortOptions || filter) && (
            <div className={styles.toolbarRow}>
              {matchesQuery && (
                <div className={styles.search}>
                  <Input
                    aria-label={searchAriaLabel}
                    hideLabel
                    fullWidth
                    className={styles.searchInput}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    icon={<span className="material-icons">search</span>}
                  />
                </div>
              )}
              {sortOptions && sortOptions.length > 0 && (
                <DropdownMenu
                  isOpen={isSortMenuOpen}
                  onOpenChange={setIsSortMenuOpen}
                  options={sortMenuOptions}
                >
                  <Button
                    variant="secondary"
                    color={sortKey ? "brand" : "neutral"}
                    active={sortKey !== null}
                    icon={<span className="material-icons">swap_vert</span>}
                    aria-label={sortAriaLabel}
                    onClick={() => setIsSortMenuOpen((open) => !open)}
                  />
                </DropdownMenu>
              )}
              {filter && (
                <Button
                  variant="secondary"
                  color={filter.isActive ? "brand" : "neutral"}
                  active={filter.isActive}
                  icon={<span className="material-icons">filter_list</span>}
                  aria-label={filter.ariaLabel ?? "Filtrer"}
                  onClick={() => setIsFilterModalOpen(true)}
                />
              )}
            </div>
          )}
          {selection && (
            <div className={styles.selectionRow}>
              <Button
                type="button"
                size="nano"
                color="neutral"
                onClick={() => selection.onSelectAll(selectableItems.map(getKey))}
              >
                Tout sélectionner ({selectableItems.length})
              </Button>
              <Button
                type="button"
                size="nano"
                color="neutral"
                onClick={selection.onClear}
              >
                Tout désélectionner
              </Button>
            </div>
          )}
        </div>
      )}

      {filter?.renderModal({
        isOpen: isFilterModalOpen,
        onClose: () => setIsFilterModalOpen(false),
      })}

      {visibleItems.length === 0 ? (
        <p className={styles.empty}>
          {items.length === 0 ? emptyMessage : noResultsMessage}
        </p>
      ) : (
        <ul className={styles.list}>
          {visibleItems.map((item) => {
            const key = getKey(item);
            return (
              <li key={key}>
                {renderItem(item, {
                  selected: selection?.selectedKeys.has(key) ?? false,
                  toggle: () => selection?.onToggle(key),
                  onMouseEnter: () => setHoveredKey(key),
                  onMouseLeave: () =>
                    setHoveredKey((current) =>
                      current === key ? null : current,
                    ),
                })}
              </li>
            );
          })}
        </ul>
      )}

      {footer}
    </section>
  );
}
