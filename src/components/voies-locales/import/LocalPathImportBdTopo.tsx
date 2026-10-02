"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { Button } from "@gouvfr-lasuite/ui-components";
import Link from "next/link";
import MapContext from "@/contexts/MapContext";
import type { AssembledLocalPathResponse } from "./types";
import { CLASSEMENT_LABELS, LocalPathClassement } from "../types";
import { LocalPathImportMap } from "./LocalPathImportMap";
import {
  LeftPanelList,
  type LeftPanelSortOption,
} from "@/components/common/left-panel-list/LeftPanelList";
import {
  LeftPanelFilterModal,
  type LeftPanelFilterSelection,
} from "@/components/common/left-panel-list/LeftPanelFilterModal";
import styles from "./LocalPathImportBdTopo.module.css";

const CLASSEMENT_ABBR: Record<LocalPathClassement, string> = {
  [LocalPathClassement.CHEMIN_RURAL]: "CR",
  [LocalPathClassement.VOIE_COMMUNALE]: "VC",
};

const CLASSEMENT_CLASS: Record<LocalPathClassement, string> = {
  [LocalPathClassement.CHEMIN_RURAL]: styles.classementCheminRural,
  [LocalPathClassement.VOIE_COMMUNALE]: styles.classementVoieCommunale,
};

function formatLength(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

export function pathLabel(path: AssembledLocalPathResponse): string {
  const nom = path.nom?.trim();
  if (nom) return nom;
  const classement = CLASSEMENT_LABELS[path.classement];
  if (path.numero != null) return `${classement} n°${path.numero}`;
  return `${classement} sans nom`;
}

const SORT_OPTIONS: LeftPanelSortOption<AssembledLocalPathResponse>[] = [
  {
    key: "nom-asc",
    label: "Nom (A → Z)",
    comparator: (a, b) => pathLabel(a).localeCompare(pathLabel(b), "fr"),
  },
  {
    key: "nom-desc",
    label: "Nom (Z → A)",
    comparator: (a, b) => pathLabel(b).localeCompare(pathLabel(a), "fr"),
  },
  {
    key: "numero-asc",
    label: "Numéro croissant",
    comparator: (a, b) =>
      (a.numero ?? Number.POSITIVE_INFINITY) -
      (b.numero ?? Number.POSITIVE_INFINITY),
  },
  {
    key: "numero-desc",
    label: "Numéro décroissant",
    comparator: (a, b) =>
      (b.numero ?? Number.NEGATIVE_INFINITY) -
      (a.numero ?? Number.NEGATIVE_INFINITY),
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
    key: "longueur-desc",
    label: "Longueur décroissante",
    comparator: (a, b) => b.longueur - a.longueur,
  },
];

const FILTER_GROUP_CLASSEMENT = "classement";

const FILTER_GROUPS = [
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
  return { [FILTER_GROUP_CLASSEMENT]: new Set() };
}

function matchesImportQuery(
  path: AssembledLocalPathResponse,
  query: string,
): boolean {
  return (
    pathLabel(path).toLocaleLowerCase().includes(query) ||
    (path.numero != null && String(path.numero).includes(query))
  );
}

export function LocalPathImportBdTopo({
  codeCommune,
}: {
  codeCommune: string;
}) {
  const router = useRouter();
  const { setMapChildren, setMapMessage } = useContext(MapContext);
  const [pending, startTransition] = useTransition();

  const [paths, setPaths] = useState<AssembledLocalPathResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [filters, setFilters] =
    useState<LeftPanelFilterSelection>(emptyFilterSelection);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/voies-locales/import/bd-topo")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json() as Promise<AssembledLocalPathResponse[]>;
      })
      .then((data) => {
        if (cancelled) return;
        setPaths(data);
        // Tous les chemins proposés ont matché le cadastre : ils sont présélectionnés.
        setSelected(
          new Set(data.filter((p) => !p.alreadyImported).map((p) => p.key)),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(
            "Impossible de récupérer les voies locales issues du cadastre.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [codeCommune]);

  const importable = useMemo(
    () => (paths ?? []).filter((p) => !p.alreadyImported),
    [paths],
  );

  const classementFilters = filters[FILTER_GROUP_CLASSEMENT];
  const hasActiveFilters = classementFilters.size > 0;

  const matchesFilters = useCallback(
    (path: AssembledLocalPathResponse) =>
      classementFilters.size === 0 || classementFilters.has(path.classement),
    [classementFilters],
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

  const toggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((keys: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      keys.forEach((key) => next.add(key));
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const selection = useMemo(
    () => ({
      selectedKeys: selected,
      onToggle: toggle,
      onSelectAll: handleSelectAll,
      onClear: clearSelection,
    }),
    [selected, toggle, handleSelectAll, clearSelection],
  );

  useEffect(() => {
    setMapChildren(
      <LocalPathImportMap
        paths={paths ?? []}
        selected={selected}
        hoveredKey={hoveredKey}
        onToggle={toggle}
      />,
    );
    return () => setMapChildren(null);
  }, [setMapChildren, paths, selected, hoveredKey, toggle]);

  useEffect(() => {
    if (!paths || loadError) {
      return;
    }

    setMapMessage(
      "Sélectionnez les voies locales issues du cadastre à importer en brouillon.",
    );
    return () => setMapMessage(null);
  }, [setMapMessage, paths, loadError]);

  function submitImport() {
    setImportError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/voies-locales/import/bd-topo", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ keys: [...selected] }),
        });
        if (!res.ok) {
          setImportError("Échec de l'import.");
          return;
        }
        router.push(`/${codeCommune}/voies-locales`);
      } catch {
        setImportError("Échec de l'import.");
      }
    });
  }

  const header = (
    <div className={styles.header}>
      <Link href={`/${codeCommune}/voies-locales`} className={styles.back}>
        <span className="material-icons">arrow_back</span>
        Retour à la liste
      </Link>
      <h2 className={styles.title}>Importer des voies locales</h2>
      <p className={styles.description}>
        Ces voies locales ont été reconstituées à partir de la voirie BD TOPO
        coïncidant avec l&apos;habillage cadastral. Vous pourrez ensuite
        qualifier chaque voie importée (numéro, revêtement…) individuellement.
      </p>
    </div>
  );

  if (loadError) {
    return (
      <section className={styles.container} aria-label="Import BD TOPO">
        {header}
        <p className={styles.error}>{loadError}</p>
      </section>
    );
  }

  if (!paths) {
    return (
      <section className={styles.container} aria-label="Import BD TOPO">
        {header}
        <div className={styles.loading} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          <span>Reconstitution des voies locales…</span>
          <span className={styles.loadingHint}>
            Cette opération peut prendre plusieurs minutes selon la taille de la
            commune.
          </span>
        </div>
      </section>
    );
  }

  return (
    <LeftPanelList
      ariaLabel="Import BD TOPO"
      items={importable}
      getKey={(p) => p.key}
      header={header}
      searchAriaLabel="Rechercher une voie locale"
      matchesQuery={matchesImportQuery}
      sortOptions={SORT_OPTIONS}
      sortAriaLabel="Trier les voies locales"
      filter={filter}
      selection={selection}
      onHoverChange={setHoveredKey}
      emptyMessage={
        paths.length === 0
          ? "Aucune voie locale cadastrale n'a pu être reconstituée pour cette commune."
          : "Toutes les voies locales cadastrales de cette commune ont déjà été importées."
      }
      noResultsMessage="Aucun résultat pour cette recherche."
      footer={
        <>
          {importError && <p className={styles.error}>{importError}</p>}
          <div className={styles.footer}>
            <Button
              color="brand"
              disabled={selected.size === 0 || pending}
              onClick={submitImport}
            >
              {pending
                ? "Import en cours…"
                : `Importer la sélection (${selected.size})`}
            </Button>
          </div>
        </>
      }
      renderItem={(p, ctx) => (
        <label
          className={styles.item}
          onMouseEnter={ctx.onMouseEnter}
          onMouseLeave={ctx.onMouseLeave}
        >
          <input type="checkbox" checked={ctx.selected} onChange={ctx.toggle} />
          <span className={styles.itemBody}>
            <span className={styles.itemTitle}>{pathLabel(p)}</span>
            <span className={styles.itemMeta}>
              <span
                className={`${styles.classementBadge} ${CLASSEMENT_CLASS[p.classement]}`}
                title={CLASSEMENT_LABELS[p.classement]}
              >
                {CLASSEMENT_ABBR[p.classement]}
              </span>
              <span>{formatLength(p.longueur)}</span>
            </span>
          </span>
        </label>
      )}
    />
  );
}
