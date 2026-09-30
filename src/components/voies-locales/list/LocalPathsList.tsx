"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Input } from "@gouvfr-lasuite/ui-components";
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

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return localPaths.filter((p) => {
      if (statusFilters.size > 0 && !statusFilters.has(p.statut)) return false;
      if (classementFilters.size > 0 && !classementFilters.has(p.classement))
        return false;
      if (!q) return true;
      return (p.nom ?? "").toLocaleLowerCase().includes(q);
    });
  }, [localPaths, query, statusFilters, classementFilters]);

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
          {filtered.map((p) => (
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
                <span className={styles.itemTitle}>
                  {p.nom?.trim() || "Chemin sans nom"}
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
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
