"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Button,
  DropdownMenu,
  DropdownMenuItem,
  Input,
  Tooltip,
  useDropdownMenu,
} from "@gouvfr-lasuite/ui-components";
import styles from "./LocalPathsList.module.css";
import {
  LocalPath,
  LocalPathStatus,
  LocalPathClassement,
  CLASSEMENT_LABELS,
} from "@/components/voies-locales/types";
import { useLocalPathsListEffects } from "./useLocalPathsListEffects";
import { LocalPathsFilterModal } from "./LocalPathsFilterModal";

interface LocalPathListProps {
  codeCommune: string;
  localPaths: LocalPath[];
}

const STATUS_LABEL: Record<LocalPathStatus, string> = {
  [LocalPathStatus.DRAFT]: "Brouillon",
  [LocalPathStatus.PUBLISHED]: "Publié",
  [LocalPathStatus.CERTIFIED]: "Certifié",
};

const STATUS_CLASS: Record<LocalPathStatus, string> = {
  [LocalPathStatus.DRAFT]: styles.statusDraft,
  [LocalPathStatus.PUBLISHED]: styles.statusPublished,
  [LocalPathStatus.CERTIFIED]: styles.statusCertified,
};

const CLASSEMENT_ABBR: Record<LocalPathClassement, string> = {
  [LocalPathClassement.CHEMIN_RURAL]: "CR",
  [LocalPathClassement.VOIE_COMMUNALE]: "VC",
};

const CLASSEMENT_CLASS: Record<LocalPathClassement, string> = {
  [LocalPathClassement.CHEMIN_RURAL]: styles.classementCheminRural,
  [LocalPathClassement.VOIE_COMMUNALE]: styles.classementVoieCommunale,
};

const STATUS_ORDER: Record<LocalPathStatus, number> = {
  [LocalPathStatus.DRAFT]: 0,
  [LocalPathStatus.PUBLISHED]: 1,
  [LocalPathStatus.CERTIFIED]: 2,
};

type SortKey =
  | "nom-asc"
  | "nom-desc"
  | "numero-asc"
  | "numero-desc"
  | "type"
  | "statut";

const SORT_LABELS: Record<SortKey, string> = {
  "nom-asc": "Nom (A → Z)",
  "nom-desc": "Nom (Z → A)",
  "numero-asc": "Numéro croissant",
  "numero-desc": "Numéro décroissant",
  type: "Type",
  statut: "Statut",
};

const SORT_COMPARATORS: Record<
  SortKey,
  (a: LocalPath, b: LocalPath) => number
> = {
  "nom-asc": (a, b) =>
    (a.nom?.trim() ?? "").localeCompare(b.nom?.trim() ?? "", "fr"),
  "nom-desc": (a, b) =>
    (b.nom?.trim() ?? "").localeCompare(a.nom?.trim() ?? "", "fr"),
  "numero-asc": (a, b) => a.numero - b.numero,
  "numero-desc": (a, b) => b.numero - a.numero,
  type: (a, b) =>
    CLASSEMENT_LABELS[a.classement].localeCompare(
      CLASSEMENT_LABELS[b.classement],
      "fr",
    ),
  statut: (a, b) => STATUS_ORDER[a.statut] - STATUS_ORDER[b.statut],
};

export function LocalPathList({ codeCommune, localPaths }: LocalPathListProps) {
  const [query, setQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<Set<LocalPathStatus>>(
    new Set(),
  );
  const [classementFilters, setClassementFilters] = useState<
    Set<LocalPathClassement>
  >(new Set());
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const hasActiveFilters = statusFilters.size > 0 || classementFilters.size > 0;
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const { isOpen: isSortMenuOpen, setIsOpen: setIsSortMenuOpen } =
    useDropdownMenu();

  const sortMenuOptions: DropdownMenuItem[] = useMemo(
    () =>
      (Object.keys(SORT_LABELS) as SortKey[]).map((key) => ({
        id: key,
        label: SORT_LABELS[key],
        isChecked: sortKey === key,
        callback: () => setSortKey(key),
      })),
    [sortKey],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const result = localPaths.filter((p) => {
      if (statusFilters.size > 0 && !statusFilters.has(p.statut)) return false;
      if (classementFilters.size > 0 && !classementFilters.has(p.classement))
        return false;
      if (!q) return true;
      return (p.nom ?? "").toLocaleLowerCase().includes(q);
    });
    if (!sortKey) return result;
    return [...result].sort(SORT_COMPARATORS[sortKey]);
  }, [localPaths, query, statusFilters, classementFilters, sortKey]);

  // Compte des noms (normalisés) sur l'ensemble des chemins, pour détecter les doublons
  const nameOccurrences = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of localPaths) {
      const name = p.nom?.trim().toLocaleLowerCase();
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return counts;
  }, [localPaths]);

  const getWarnings = (p: LocalPath): string[] => {
    const trimmedName = p.nom?.trim();
    if (!trimmedName) return ["Ce chemin n'a pas de nom."];
    if ((nameOccurrences.get(trimmedName.toLocaleLowerCase()) ?? 0) > 1) {
      return ["Ce nom est utilisé par plusieurs chemins."];
    }
    return [];
  };

  const { setHoveredPathId } = useLocalPathsListEffects({
    localPaths: filtered,
  });

  return (
    <section className={styles.container} aria-label="Liste des voies locales">
      <div className={styles.toolbar}>
        <div className={styles.toolbarRow}>
          <div className={styles.search}>
            <Input
              aria-label="Rechercher une voie locale"
              hideLabel
              fullWidth
              className={styles.searchInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              icon={<span className="material-icons">search</span>}
            />
          </div>
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
              aria-label="Trier les voies locales"
              onClick={() => setIsSortMenuOpen((open) => !open)}
            />
          </DropdownMenu>
          <Button
            variant="secondary"
            color={hasActiveFilters ? "brand" : "neutral"}
            active={hasActiveFilters}
            icon={<span className="material-icons">filter_list</span>}
            aria-label="Filtrer les voies locales"
            onClick={() => setIsFilterModalOpen(true)}
          />
        </div>
      </div>
      <LocalPathsFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        statusFilters={statusFilters}
        classementFilters={classementFilters}
        onApply={(status, classement) => {
          setStatusFilters(status);
          setClassementFilters(classement);
        }}
      />

      {filtered.length === 0 ? (
        <p className={styles.empty}>
          {localPaths.length === 0
            ? "Aucune voie locale pour cette commune."
            : "Aucun résultat pour ces filtres."}
        </p>
      ) : (
        <ul className={styles.list}>
          {filtered.map((p) => {
            const warnings = getWarnings(p);
            return (
              <li key={p.id}>
                <Link
                  href={`/${codeCommune}/voies-locales/${p.id}`}
                  className={styles.item}
                  onMouseEnter={() => setHoveredPathId(p.id)}
                  onMouseLeave={() =>
                    setHoveredPathId((current) =>
                      current === p.id ? null : current,
                    )
                  }
                >
                  <span className={styles.itemContent}>
                    <span className={styles.itemTitle}>
                      {p.nom?.trim() || "Chemin sans nom"}
                      <span className={styles.itemNumero}> n°{p.numero}</span>
                    </span>
                    <span className={styles.itemMeta}>
                      <span
                        className={`${styles.classementBadge} ${CLASSEMENT_CLASS[p.classement]}`}
                        title={CLASSEMENT_LABELS[p.classement]}
                      >
                        {CLASSEMENT_ABBR[p.classement]}
                      </span>
                      <span
                        className={`${styles.statusBadge} ${STATUS_CLASS[p.statut]}`}
                      >
                        {STATUS_LABEL[p.statut]}
                      </span>
                    </span>
                  </span>
                  {warnings.length > 0 && (
                    <Tooltip content={warnings.join(" ")} placement="top">
                      <span className={styles.warningIcon}>
                        <span className="material-icons" aria-hidden="true">
                          warning
                        </span>
                      </span>
                    </Tooltip>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
