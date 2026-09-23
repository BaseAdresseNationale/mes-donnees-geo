"use client";

import { useContext, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Filter,
  FilterOption,
  Input,
} from "@gouvfr-lasuite/ui-components";
import Link from "next/link";
import MapContext from "@/contexts/MapContext";
import { CLASSEMENT_LABELS } from "@/components/chemins-ruraux/types";
import { RuralPathClassement } from "@/generated/prisma/browser";
import type { BdTopoCandidateResponse } from "./types";
import { RuralPathImportMap } from "./RuralPathImportMap";
import styles from "./RuralPathImportBdTopo.module.css";

function formatLength(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

export function RuralPathImportBdTopo({
  codeCommune,
}: {
  codeCommune: string;
}) {
  const router = useRouter();
  const { setMapChildren, setMapMessage } = useContext(MapContext);
  const [pending, startTransition] = useTransition();

  const [candidates, setCandidates] = useState<
    BdTopoCandidateResponse[] | null
  >(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [classementFilter, setClassementFilter] =
    useState<RuralPathClassement | null>(null);
  const [hoveredCleabs, setHoveredCleabs] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/chemins-ruraux/import/bd-topo")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json() as Promise<BdTopoCandidateResponse[]>;
      })
      .then((data) => {
        if (!cancelled) {
          setCandidates(data);
          // Les chemins ruraux sont présélectionnés (import quasi-systématique) ;
          // les voies communales restent à cocher manuellement.
          setSelected(
            new Set(
              data
                .filter(
                  (c) =>
                    !c.alreadyImported &&
                    c.suggestedClassement === RuralPathClassement.CHEMIN_RURAL,
                )
                .map((c) => c.cleabs),
            ),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("Impossible de récupérer la voirie BD TOPO.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [codeCommune]);

  const filtered = useMemo(() => {
    if (!candidates) return [];
    const q = query.trim().toLocaleLowerCase();
    return candidates.filter((c) => {
      if (c.alreadyImported) return false;
      if (
        classementFilter !== null &&
        c.suggestedClassement !== classementFilter
      )
        return false;
      if (!q) return true;
      return (c.nomVoie ?? "").toLocaleLowerCase().includes(q);
    });
  }, [candidates, query, classementFilter]);

  const classementOptions: FilterOption[] = useMemo(
    () =>
      Object.values(RuralPathClassement).map((v) => ({
        label: CLASSEMENT_LABELS[v],
        value: v,
      })),
    [],
  );

  function toggle(cleabs: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cleabs)) next.delete(cleabs);
      else next.add(cleabs);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((c) => next.add(c.cleabs));
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  useEffect(() => {
    setMapChildren(
      <RuralPathImportMap
        candidates={candidates ?? []}
        selected={selected}
        hoveredCleabs={hoveredCleabs}
        onToggle={toggle}
      />,
    );
    return () => setMapChildren(null);
  }, [setMapChildren, candidates, selected, hoveredCleabs]);

  useEffect(() => {
    if (!candidates || loadError) {
      return;
    }

    setMapMessage(
      "Sélectionnez les tronçons de voirie à importer comme chemins en brouillon.",
    );
    return () => setMapMessage(null);
  }, [setMapMessage, candidates, loadError]);

  function submitImport() {
    setImportError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/chemins-ruraux/import/bd-topo", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cleabs: [...selected] }),
        });
        if (!res.ok) {
          setImportError("Échec de l'import.");
          return;
        }
        router.push(`/${codeCommune}/chemins-ruraux`);
      } catch {
        setImportError("Échec de l'import.");
      }
    });
  }

  return (
    <section className={styles.container} aria-label="Import BD TOPO">
      <div className={styles.header}>
        <Link href={`/${codeCommune}/chemins-ruraux`} className={styles.back}>
          <span className="material-icons">arrow_back</span>
          Retour à la liste
        </Link>
        <h2 className={styles.title}>Importer depuis la BD TOPO</h2>
        <p className={styles.description}>
          Vous pourrez ensuite qualifier chaque chemin importé (classement,
          numéro, revêtement…) individuellement.
        </p>
      </div>

      {loadError && <p className={styles.error}>{loadError}</p>}

      {!candidates && !loadError && (
        <div className={styles.loading} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          <span>Chargement de la voirie BD TOPO…</span>
          <span className={styles.loadingHint}>
            Cette opération peut prendre plusieurs minutes selon la taille de la
            commune.
          </span>
        </div>
      )}

      {candidates && (
        <>
          <div className={styles.toolbar}>
            <div className={styles.toolbarRow}>
              <div className={styles.search}>
                <Input
                  aria-label="Rechercher une voie"
                  hideLabel
                  className={styles.searchInput}
                  fullWidth
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  icon={<span className="material-icons">search</span>}
                />
              </div>
            </div>
            <Filter
              label="Filtrer par classement suggéré"
              options={classementOptions}
              value={classementFilter}
              onChange={(value) =>
                setClassementFilter(value as RuralPathClassement)
              }
            />
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
              {candidates.every((c) => c.alreadyImported)
                ? "Tous les tronçons BD TOPO de cette commune ont déjà été importés."
                : "Aucun résultat pour ces filtres."}
            </p>
          ) : (
            <ul className={styles.list}>
              {filtered.map((c) => (
                <li key={c.cleabs}>
                  <label
                    className={styles.item}
                    onMouseEnter={() => setHoveredCleabs(c.cleabs)}
                    onMouseLeave={() =>
                      setHoveredCleabs((cur) => (cur === c.cleabs ? null : cur))
                    }
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(c.cleabs)}
                      onChange={() => toggle(c.cleabs)}
                    />
                    <span className={styles.itemBody}>
                      <span className={styles.itemTitle}>
                        {c.nomVoie?.trim() || "Voie sans nom"}
                      </span>
                      <span className={styles.itemMeta}>
                        <span>{c.nature}</span>
                        <span>{CLASSEMENT_LABELS[c.suggestedClassement]}</span>
                        {c.suggestedNumero != null && (
                          <span>Cadastre n°{c.suggestedNumero}</span>
                        )}
                        <span>{formatLength(c.longueur)}</span>
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
