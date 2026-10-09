"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Button, Tooltip } from "@gouvfr-lasuite/ui-components";
import styles from "./LocalPathsList.module.css";
import {
  LocalPath,
  LocalPathStatus,
  LocalPathClassement,
  CLASSEMENT_LABELS,
} from "@/components/voies-locales/types";
import type { PublicationOverview } from "@/lib/publication/types";
import { useLocalPathsListEffects } from "./useLocalPathsListEffects";
import {
  LeftPanelList,
  type LeftPanelSortOption,
} from "@/components/common/left-panel-list/LeftPanelList";
import {
  LeftPanelFilterModal,
  type LeftPanelFilterSelection,
} from "@/components/common/left-panel-list/LeftPanelFilterModal";

interface LocalPathListProps {
  codeCommune: string;
  localPaths: LocalPath[];
  publication: PublicationOverview;
}

const STATUS_LABEL: Record<LocalPathStatus, string> = {
  [LocalPathStatus.A_QUALIFIER]: "À qualifier",
  [LocalPathStatus.QUALIFIEE]: "Qualifiée",
};

const STATUS_CLASS: Record<LocalPathStatus, string> = {
  [LocalPathStatus.A_QUALIFIER]: styles.statusToQualify,
  [LocalPathStatus.QUALIFIEE]: styles.statusQualified,
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
  [LocalPathStatus.A_QUALIFIER]: 0,
  [LocalPathStatus.QUALIFIEE]: 1,
};

const SORT_OPTIONS: LeftPanelSortOption<LocalPath>[] = [
  {
    key: "nom-asc",
    label: "Nom (A → Z)",
    comparator: (a, b) =>
      (a.nom?.trim() ?? "").localeCompare(b.nom?.trim() ?? "", "fr"),
  },
  {
    key: "nom-desc",
    label: "Nom (Z → A)",
    comparator: (a, b) =>
      (b.nom?.trim() ?? "").localeCompare(a.nom?.trim() ?? "", "fr"),
  },
  {
    key: "numero-asc",
    label: "Numéro croissant",
    comparator: (a, b) => a.numero - b.numero,
  },
  {
    key: "numero-desc",
    label: "Numéro décroissant",
    comparator: (a, b) => b.numero - a.numero,
  },
  {
    key: "type",
    label: "Type",
    comparator: (a, b) =>
      CLASSEMENT_LABELS[a.classement].localeCompare(
        CLASSEMENT_LABELS[b.classement],
        "fr",
      ),
  },
  {
    key: "statut",
    label: "Statut",
    comparator: (a, b) => STATUS_ORDER[a.statut] - STATUS_ORDER[b.statut],
  },
];

const FILTER_GROUP_STATUS = "statut";
const FILTER_GROUP_CLASSEMENT = "classement";

const FILTER_GROUPS = [
  {
    id: FILTER_GROUP_STATUS,
    legend: "Statut",
    options: Object.values(LocalPathStatus).map((value) => ({
      value,
      label: STATUS_LABEL[value],
    })),
  },
  {
    id: FILTER_GROUP_CLASSEMENT,
    legend: "Type",
    options: Object.values(LocalPathClassement).map((value) => ({
      value,
      label: CLASSEMENT_LABELS[value],
    })),
  },
];

function emptyFilterSelection(): LeftPanelFilterSelection {
  return {
    [FILTER_GROUP_STATUS]: new Set(),
    [FILTER_GROUP_CLASSEMENT]: new Set(),
  };
}

function matchesLocalPathQuery(path: LocalPath, query: string): boolean {
  return (path.nom ?? "").toLocaleLowerCase().includes(query);
}

export function LocalPathList({
  codeCommune,
  localPaths,
  publication,
}: LocalPathListProps) {
  const router = useRouter();
  const [filters, setFilters] =
    useState<LeftPanelFilterSelection>(emptyFilterSelection);
  const [visiblePaths, setVisiblePaths] = useState<LocalPath[]>(localPaths);
  const [hoveredPathId, setHoveredPathId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [qualifying, setQualifying] = useState(false);
  const [qualifyError, setQualifyError] = useState<string | null>(null);

  const changeKindById = useMemo(
    () => new Map(publication.changes.map((c) => [c.id, c.kind])),
    [publication.changes],
  );
  const publishedIds = useMemo(
    () => new Set(publication.publishedPathIds),
    [publication.publishedPathIds],
  );
  const hasPathsToQualify = useMemo(
    () => localPaths.some((p) => p.statut === LocalPathStatus.A_QUALIFIER),
    [localPaths],
  );

  const isQualifiable = useCallback(
    (p: LocalPath) => p.statut === LocalPathStatus.A_QUALIFIER,
    [],
  );

  const selection = useMemo(
    () =>
      hasPathsToQualify
        ? {
            selectedKeys: selectedIds,
            onToggle: (key: string) =>
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (!next.delete(key)) next.add(key);
                return next;
              }),
            onSelectAll: (keys: string[]) => setSelectedIds(new Set(keys)),
            onClear: () => setSelectedIds(new Set()),
          }
        : undefined,
    [hasPathsToQualify, selectedIds],
  );

  async function qualifySelection() {
    setQualifying(true);
    setQualifyError(null);
    try {
      const response = await fetch("/api/voies-locales/qualify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      if (!response.ok) {
        setQualifyError("La qualification a échoué.");
        return;
      }
      setSelectedIds(new Set());
      router.refresh();
    } catch {
      setQualifyError("La qualification a échoué.");
    } finally {
      setQualifying(false);
    }
  }

  function publicationMarker(
    p: LocalPath,
  ): { label: string; className: string } | null {
    if (changeKindById.get(p.id) === "modified") {
      return {
        label: "Modifiée depuis publication",
        className: styles.publicationModified,
      };
    }
    if (publishedIds.has(p.id) && !changeKindById.has(p.id)) {
      return { label: "Publiée", className: styles.publicationPublished };
    }
    return null;
  }

  const statusFilters = filters[FILTER_GROUP_STATUS];
  const classementFilters = filters[FILTER_GROUP_CLASSEMENT];
  const hasActiveFilters = statusFilters.size > 0 || classementFilters.size > 0;

  const matchesFilters = useCallback(
    (path: LocalPath) => {
      if (statusFilters.size > 0 && !statusFilters.has(path.statut))
        return false;
      if (classementFilters.size > 0 && !classementFilters.has(path.classement))
        return false;
      return true;
    },
    [statusFilters, classementFilters],
  );

  const filter = useMemo(
    () => ({
      isActive: hasActiveFilters,
      ariaLabel: "Filtrer les voies locales",
      matches: matchesFilters,
      renderModal: ({
        isOpen,
        onClose,
      }: {
        isOpen: boolean;
        onClose: () => void;
      }) => (
        <LeftPanelFilterModal
          isOpen={isOpen}
          onClose={onClose}
          title="Filtrer les voies locales"
          groups={FILTER_GROUPS}
          selected={filters}
          onApply={setFilters}
        />
      ),
    }),
    [hasActiveFilters, matchesFilters, filters],
  );

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

  useLocalPathsListEffects({
    localPaths: visiblePaths,
    allLocalPaths: localPaths,
    hoveredPathId,
    changes: publication.changes,
  });

  return (
    <LeftPanelList
      ariaLabel="Liste des voies locales"
      items={localPaths}
      getKey={(p) => p.id}
      searchAriaLabel="Rechercher une voie locale"
      matchesQuery={matchesLocalPathQuery}
      sortOptions={SORT_OPTIONS}
      sortAriaLabel="Trier les voies locales"
      filter={filter}
      selection={selection}
      isSelectable={isQualifiable}
      onHoverChange={setHoveredPathId}
      onVisibleItemsChange={setVisiblePaths}
      emptyMessage="Aucune voie locale pour cette commune."
      noResultsMessage="Aucun résultat pour ces filtres."
      footer={
        selectedIds.size > 0 ? (
          <div className={styles.qualifyFooter}>
            {qualifyError && <p role="alert">{qualifyError}</p>}
            <Button
              color="brand"
              size="small"
              disabled={qualifying}
              onClick={qualifySelection}
            >
              {qualifying
                ? "Qualification en cours…"
                : `Qualifier la sélection (${selectedIds.size})`}
            </Button>
          </div>
        ) : undefined
      }
      renderItem={(p, ctx) => {
        const warnings = getWarnings(p);
        const marker = publicationMarker(p);
        const link = (
          <Link
            href={`/${codeCommune}/voies-locales/${p.id}`}
            className={styles.item}
            onMouseEnter={ctx.onMouseEnter}
            onMouseLeave={ctx.onMouseLeave}
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
                {marker && (
                  <span
                    className={`${styles.statusBadge} ${marker.className}`}
                  >
                    {marker.label}
                  </span>
                )}
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
        );
        if (!selection || !isQualifiable(p)) return link;
        return (
          <div className={styles.itemRow}>
            <input
              type="checkbox"
              checked={ctx.selected}
              onChange={ctx.toggle}
              aria-label={`Sélectionner ${p.nom?.trim() || "ce chemin"} n°${p.numero}`}
            />
            {link}
          </div>
        );
      }}
    />
  );
}
