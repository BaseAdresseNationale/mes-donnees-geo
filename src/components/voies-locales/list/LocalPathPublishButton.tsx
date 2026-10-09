"use client";

import { Button, Icon } from "@gouvfr-lasuite/ui-components";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  PublicationChange,
  PublicationChangeKind,
} from "@/lib/publication/types";
import { CLASSEMENT_LABELS } from "@/components/voies-locales/types";
import styles from "./LocalPathPublishButton.module.css";

export interface PublishHighlightRequest {
  id: string;
  /** Recentre aussi la carte sur la voie. */
  fit: boolean;
}

const GROUPS: { kind: PublicationChangeKind; label: string }[] = [
  { kind: "added", label: "Ajoutées" },
  { kind: "modified", label: "Modifiées" },
  { kind: "deleted", label: "Supprimées" },
];

export function LocalPathPublishButton({
  changes,
  onHighlight,
}: {
  changes: PublicationChange[];
  onHighlight: (request: PublishHighlightRequest | null) => void;
}) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  // Tout est coché par défaut : on mémorise les exclusions pour que les nouveaux changements le soient aussi.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedIds = useMemo(
    () => changes.filter((c) => !excluded.has(c.id)).map((c) => c.id),
    [changes, excluded],
  );

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) onHighlight(null);
  }, [isOpen, onHighlight]);

  const toggle = (ids: string[], checked: boolean) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.delete(id);
        else next.add(id);
      }
      return next;
    });

  async function publish() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/voies-locales/publication", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? "La publication a échoué.");
        return;
      }
      setIsOpen(false);
      router.refresh();
    } catch {
      setError("La publication a échoué.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <span className={styles.buttonWrapper}>
        <Button
          color="brand"
          size="small"
          icon={<Icon name={isOpen ? "arrow_drop_up" : "arrow_drop_down"} />}
          iconPosition="right"
          aria-label="Publier les voies sur data.gouv.fr"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
        >
          Publier
        </Button>
        {selectedIds.length > 0 && (
          <span
            className={styles.badge}
            aria-label={`${selectedIds.length} voie(s) à publier`}
          >
            {selectedIds.length}
          </span>
        )}
      </span>

      {isOpen && (
        <div
          className={styles.panel}
          role="dialog"
          aria-label="Changements à publier"
        >
          {changes.length === 0 ? (
            <p className={styles.empty}>
              Aucun changement à publier. Seules les voies qualifiées sont
              publiables.
            </p>
          ) : (
            <div className={styles.groups}>
              {GROUPS.map(({ kind, label }) => {
                const items = changes.filter((c) => c.kind === kind);
                if (items.length === 0) return null;
                const ids = items.map((c) => c.id);
                const allChecked = ids.every((id) => !excluded.has(id));
                return (
                  <section key={kind} className={styles.group}>
                    <label
                      className={`${styles.groupHeader} ${styles[kind]}`}
                    >
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={(e) => toggle(ids, e.target.checked)}
                      />
                      {label} ({items.length})
                    </label>
                    <ul className={styles.items}>
                      {items.map((change) => (
                        <li
                          key={change.id}
                          className={styles.item}
                          onMouseEnter={() =>
                            onHighlight({ id: change.id, fit: false })
                          }
                          onMouseLeave={() => onHighlight(null)}
                        >
                          <div className={styles.itemRow}>
                            <label className={styles.itemLabel}>
                              <input
                                type="checkbox"
                                checked={!excluded.has(change.id)}
                                onChange={(e) =>
                                  toggle([change.id], e.target.checked)
                                }
                              />
                              <span className={styles.itemTitle}>
                                {change.nom?.trim() || "Chemin sans nom"}
                                <span className={styles.itemNumero}>
                                  {" "}
                                  n°{change.numero}
                                </span>
                              </span>
                            </label>
                            <span className={styles.itemClassement}>
                              {CLASSEMENT_LABELS[change.classement]}
                            </span>
                            <button
                              type="button"
                              className={styles.locate}
                              aria-label="Centrer la carte sur cette voie"
                              onClick={() =>
                                onHighlight({ id: change.id, fit: true })
                              }
                            >
                              <span
                                className="material-icons"
                                aria-hidden="true"
                              >
                                my_location
                              </span>
                            </button>
                          </div>
                          {change.fields.length > 0 && (
                            <details className={styles.details}>
                              <summary>
                                {change.fields.length} champ(s) concerné(s)
                              </summary>
                              <ul className={styles.fields}>
                                {change.fields.map((field) => (
                                  <li key={field.label}>
                                    <span className={styles.fieldLabel}>
                                      {field.label}
                                    </span>
                                    <span className={styles.fieldBefore}>
                                      {field.before ?? "—"}
                                    </span>
                                    <span aria-hidden="true"> → </span>
                                    <span className={styles.fieldAfter}>
                                      {field.after ?? "—"}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles.footer}>
            <Button
              color="brand"
              size="small"
              disabled={selectedIds.length === 0 || pending}
              onClick={publish}
            >
              {pending
                ? "Publication en cours…"
                : `Publier la sélection (${selectedIds.length})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
