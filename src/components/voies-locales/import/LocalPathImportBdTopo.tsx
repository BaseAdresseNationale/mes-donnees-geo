"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { QueryClient, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Button,
  useToastProvider,
  VariantType,
} from "@gouvfr-lasuite/ui-components";
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
import { loadBdTopoPreview } from "./load-bd-topo-preview";
import {
  readImportJob,
  writeImportJob,
  subscribeImportJob,
  serverImportJob,
} from "./import-job-storage";

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
  const { toast } = useToastProvider();
  const notifiedJobs = useRef(new Set<string>());
  const notifiedLoadErrors = useRef(new Set<string>());
  const { setMapChildren, setMapMessage } = useContext(MapContext);
  const [queryClient] = useState(() => new QueryClient());
  const [submitting, setSubmitting] = useState(false);
  const storageKey = `bd-topo-import:${codeCommune}`;
  const jobId = useSyncExternalStore(
    subscribeImportJob,
    useCallback(() => readImportJob(storageKey), [storageKey]),
    serverImportJob,
  );

  const [paths, setPaths] = useState<AssembledLocalPathResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [filters, setFilters] =
    useState<LeftPanelFilterSelection>(emptyFilterSelection);

  const importJob = useQuery(
    {
      queryKey: ["bd-topo-import", codeCommune, jobId],
      enabled: jobId !== null,
      queryFn: async ({ signal }) => {
        const response = await fetch(
          `/api/voies-locales/import/bd-topo/jobs/${jobId}`,
          { signal, cache: "no-store" },
        );
        if (response.status === 404) {
          if (!signal.aborted && readImportJob(storageKey) === jobId) {
            writeImportJob(storageKey, null);
          }
          return { status: "missing" as const, error: null };
        }
        if (response.status === 401) {
          return {
            status: "failed",
            error:
              "Votre session a expiré. Reconnectez-vous pour suivre l'import.",
          };
        }
        if (!response.ok) throw new Error("Suivi de l'import indisponible.");
        return response.json() as Promise<{
          status: "pending" | "succeeded" | "failed";
          created: number | null;
          error: string | null;
        }>;
      },
      refetchInterval: (query) =>
        !query.state.data || query.state.data.status === "pending"
          ? 2000
          : false,
    },
    queryClient,
  );
  const pending =
    submitting || (jobId !== null && importJob.data?.status !== "failed");
  const displayedImportError =
    importError ??
    (jobId && importJob.data?.status === "failed"
      ? importJob.data.error
      : null);

  useEffect(() => {
    const result = importJob.data;
    if (
      !jobId ||
      !result ||
      (result.status !== "succeeded" && result.status !== "failed")
    )
      return;
    if (!notifiedJobs.current.has(jobId)) {
      notifiedJobs.current.add(jobId);
      if (result.status === "succeeded") {
        const count = "created" in result ? result.created : null;
        toast(
          count == null
            ? "Import des voies locales terminé."
            : `${count} voie${count > 1 ? "s" : ""} locale${count > 1 ? "s" : ""} importée${count > 1 ? "s" : ""}.`,
          VariantType.SUCCESS,
          { duration: 5000 },
        );
      } else {
        toast(result.error ?? "Échec de l'import.", VariantType.ERROR, {
          duration: 8000,
        });
      }
    }
    if (result.status !== "succeeded" || readImportJob(storageKey) !== jobId)
      return;
    writeImportJob(storageKey, null);
    router.push(`/${codeCommune}/voies-locales`);
  }, [importJob.data, jobId, storageKey, router, codeCommune, toast]);

  const notifyPreviewSuccess = useEffectEvent(
    (previewId: string, count: number) => {
      if (notifiedJobs.current.has(previewId)) return;
      notifiedJobs.current.add(previewId);
      toast(`Chargement des voies locales terminé.`, VariantType.SUCCESS, {
        duration: 5000,
      });
    },
  );

  const notifyPreviewError = useEffectEvent((message: string) => {
    if (notifiedLoadErrors.current.has(message)) return;
    notifiedLoadErrors.current.add(message);
    toast(message, VariantType.ERROR, { duration: 8000 });
  });

  useEffect(() => {
    const controller = new AbortController();
    loadBdTopoPreview(controller.signal, (previewId, count) => {
      notifyPreviewSuccess(previewId, count);
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        setPaths(data);
        // Tous les chemins proposés ont matché le cadastre : ils sont présélectionnés.
        setSelected(
          new Set(data.filter((p) => !p.alreadyImported).map((p) => p.key)),
        );
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          const message =
            error instanceof Error
              ? error.message
              : "Impossible de récupérer les voies locales issues du cadastre.";
          setLoadError(message);
          notifyPreviewError(message);
        }
      });
    return () => {
      controller.abort();
    };
  }, [codeCommune, jobId]);

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

  async function submitImport() {
    if (pending) return;
    setImportError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/voies-locales/import/bd-topo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keys: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data.error ?? "Échec de l'import.";
        setImportError(message);
        toast(message, VariantType.ERROR, { duration: 8000 });
        return;
      }
      writeImportJob(storageKey, data.jobId);
    } catch {
      setImportError("Impossible de lancer l'import.");
      toast("Impossible de lancer l'import.", VariantType.ERROR, {
        duration: 8000,
      });
    } finally {
      setSubmitting(false);
    }
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
          {displayedImportError && (
            <p className={styles.error}>{displayedImportError}</p>
          )}
          {jobId && pending && (
            <p role="status">
              {importJob.isError &&
                "Connexion au suivi interrompue. Nouvelle tentative en cours…"}
            </p>
          )}
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
