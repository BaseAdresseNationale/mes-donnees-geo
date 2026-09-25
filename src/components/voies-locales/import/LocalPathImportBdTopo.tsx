"use client";

import { useContext, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@gouvfr-lasuite/ui-components";
import Link from "next/link";
import MapContext from "@/contexts/MapContext";
import type { AssembledLocalPathResponse } from "./types";
import { CLASSEMENT_LABELS, LocalPathClassement } from "../types";
import { LocalPathImportMap } from "./LocalPathImportMap";
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
  const [query, setQuery] = useState("");
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    if (!paths) return [];
    const q = query.trim().toLocaleLowerCase();
    return paths.filter((p) => {
      if (p.alreadyImported) return false;
      if (!q) return true;
      return (
        pathLabel(p).toLocaleLowerCase().includes(q) ||
        (p.numero != null && String(p.numero).includes(q))
      );
    });
  }, [paths, query]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((p) => next.add(p.key));
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

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
  }, [setMapChildren, paths, selected, hoveredKey]);

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

  return (
    <section className={styles.container} aria-label="Import BD TOPO">
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

      {loadError && <p className={styles.error}>{loadError}</p>}

      {!paths && !loadError && (
        <div className={styles.loading} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          <span>Reconstitution des voies locales…</span>
          <span className={styles.loadingHint}>
            Cette opération peut prendre plusieurs minutes selon la taille de la
            commune.
          </span>
        </div>
      )}

      {paths && (
        <>
          <div className={styles.toolbar}>
            <div className={styles.toolbarRow}>
              <div className={styles.search}>
                <Input
                  aria-label="Rechercher une voie locale"
                  hideLabel
                  className={styles.searchInput}
                  fullWidth
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  icon={<span className="material-icons">search</span>}
                />
              </div>
            </div>
            <div className={styles.selectionRow}>
              <Button size="small" color="neutral" onClick={selectAllFiltered}>
                Tout sélectionner ({filtered.length})
              </Button>
              <Button size="small" color="neutral" onClick={clearSelection}>
                Tout désélectionner
              </Button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className={styles.empty}>
              {paths.length === 0
                ? "Aucune voie locale cadastrale n'a pu être reconstituée pour cette commune."
                : paths.every((p) => p.alreadyImported)
                  ? "Toutes les voies locales cadastrales de cette commune ont déjà été importées."
                  : "Aucun résultat pour cette recherche."}
            </p>
          ) : (
            <ul className={styles.list}>
              {filtered.map((p) => (
                <li key={p.key}>
                  <label
                    className={styles.item}
                    onMouseEnter={() => setHoveredKey(p.key)}
                    onMouseLeave={() =>
                      setHoveredKey((cur) => (cur === p.key ? null : cur))
                    }
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(p.key)}
                      onChange={() => toggle(p.key)}
                    />
                    <span className={styles.itemBody}>
                      <span className={styles.itemTitle}>{pathLabel(p)}</span>
                      <span className={styles.itemMeta}>
                        <span
                          className={`${styles.classementBadge} ${CLASSEMENT_CLASS[p.classement]}`}
                          title={CLASSEMENT_LABELS[p.classement]}
                        >
                          {CLASSEMENT_ABBR[p.classement]}
                        </span>
                        <span>
                          {p.segments.length} segment
                          {p.segments.length > 1 ? "s" : ""}
                        </span>
                        <span>{formatLength(p.longueur)}</span>
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

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
      )}
    </section>
  );
}
