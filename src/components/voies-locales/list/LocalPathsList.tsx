"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Input, Filter, FilterOption } from "@gouvfr-lasuite/ui-components";
import styles from "./LocalPathsList.module.css";
import { LocalPath, LocalPathStatus } from "@/components/voies-locales/types";
import { useLocalPathsListEffects } from "./useLocalPathsListEffects";

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

export function LocalPathList({ codeCommune, localPaths }: LocalPathListProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LocalPathStatus | null>(
    null,
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return localPaths.filter((p) => {
      if (statusFilter !== null && p.statut !== statusFilter) return false;
      if (!q) return true;
      return (p.nom ?? "").toLocaleLowerCase().includes(q);
    });
  }, [localPaths, query, statusFilter]);

  const statusOptions: FilterOption[] = useMemo(
    () => [
      ...Object.values(LocalPathStatus).map((s) => ({
        label: STATUS_LABEL[s],
        value: s,
      })),
    ],
    [],
  );

  const { setHoveredPathId } = useLocalPathsListEffects({ localPaths });

  return (
    <section className={styles.container} aria-label="Liste des chemins ruraux">
      <div className={styles.toolbar}>
        <div className={styles.toolbarRow}>
          <div className={styles.search}>
            <Input
              aria-label="Rechercher un chemin rural"
              hideLabel
              fullWidth
              className={styles.searchInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              icon={<span className="material-icons">search</span>}
            />
          </div>
        </div>
        <Filter
          label="Filtrer par statut"
          options={statusOptions}
          value={statusFilter}
          onChange={(value) => setStatusFilter(value as LocalPathStatus)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className={styles.empty}>
          {localPaths.length === 0
            ? "Aucun chemin rural pour cette commune."
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
                    className={`${styles.statusBadge} ${STATUS_CLASS[p.statut]}`}
                  >
                    {STATUS_LABEL[p.statut]}
                  </span>
                  <span>
                    {p.segments.length} segment
                    {p.segments.length > 1 ? "s" : ""}
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
