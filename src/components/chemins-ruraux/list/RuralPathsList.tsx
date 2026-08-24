"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Input, Filter, FilterOption } from "@gouvfr-lasuite/ui-components";
import styles from "./RuralPathsList.module.css";
import { RuralPath, RuralPathStatus } from "@/components/chemins-ruraux/types";
import { useRuralPathsListEffects } from "./useRuralPathsListEffects";

interface RuralPathListProps {
  codeCommune: string;
  ruralPaths: RuralPath[];
}

const STATUS_LABEL: Record<RuralPathStatus, string> = {
  [RuralPathStatus.DRAFT]: "Brouillon",
  [RuralPathStatus.PUBLISHED]: "Publié",
  [RuralPathStatus.CERTIFIED]: "Certifié",
};

const STATUS_CLASS: Record<RuralPathStatus, string> = {
  [RuralPathStatus.DRAFT]: styles.statusDraft,
  [RuralPathStatus.PUBLISHED]: styles.statusPublished,
  [RuralPathStatus.CERTIFIED]: styles.statusCertified,
};

export function RuralPathList({ codeCommune, ruralPaths }: RuralPathListProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RuralPathStatus | null>(
    null,
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return ruralPaths.filter((p) => {
      if (statusFilter !== null && p.statut !== statusFilter) return false;
      if (!q) return true;
      return (p.nom ?? "").toLocaleLowerCase().includes(q);
    });
  }, [ruralPaths, query, statusFilter]);

  const statusOptions: FilterOption[] = useMemo(
    () => [
      ...Object.values(RuralPathStatus).map((s) => ({
        label: STATUS_LABEL[s],
        value: s,
      })),
    ],
    [],
  );

  const { setHoveredPathId } = useRuralPathsListEffects({ ruralPaths });

  return (
    <section className={styles.container} aria-label="Liste des chemins ruraux">
      <div className={styles.toolbar}>
        <div className={styles.toolbarRow}>
          <div className={styles.search}>
            <Input
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
          onChange={(value) => setStatusFilter(value as RuralPathStatus)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className={styles.empty}>
          {ruralPaths.length === 0
            ? "Aucun chemin rural pour cette commune."
            : "Aucun résultat pour ces filtres."}
        </p>
      ) : (
        <ul className={styles.list}>
          {filtered.map((p) => (
            <li key={p.id}>
              <Link
                href={`/${codeCommune}/chemins-ruraux/${p.id}`}
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
