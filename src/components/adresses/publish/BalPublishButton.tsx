"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Icon,
  useToastProvider,
  VariantType,
} from "@gouvfr-lasuite/ui-components";
import { createBalClient } from "@/lib/api-bal/browser-client";
import {
  findBaseLocaleEvents,
  findBaseLocaleVoies,
  publishBaseLocale,
} from "@/lib/api-bal/generated/sdk.gen";
import type { Event } from "@/lib/api-bal/generated/types.gen";
import {
  ACTION_GROUPS,
  apiErrorMessage,
  eventDetail,
  eventTitle,
  formatEventDate,
} from "./event-labels";
import styles from "./BalPublishButton.module.css";

const GROUP_CLASS = {
  CREATE: styles.added,
  UPDATE: styles.modified,
  DELETE: styles.deleted,
} as const;

// Bouton « Publier » de la barre d'outils : nombre de modifications de la BAL
// non publiées (événements principaux en attente de mes-adresses-api), liste
// avec cases à cocher et publication des seules modifications cochées.
export function BalPublishButton({
  balId,
  changesVersion,
}: {
  balId: string;
  // Incrémenté à chaque modification faite ici : recharge les événements
  changesVersion: number;
}) {
  const router = useRouter();
  const { toast } = useToastProvider();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [voieNames, setVoieNames] = useState<Record<string, string>>({});
  // Tout est coché par défaut : on mémorise les décochés (ignorés)
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);

  const loadEvents = useCallback(async () => {
    const client = createBalClient(balId);
    const [eventsResult, voiesResult] = await Promise.all([
      findBaseLocaleEvents({ client, path: { baseLocaleId: balId } }),
      findBaseLocaleVoies({ client, path: { baseLocaleId: balId } }),
    ]);
    if (eventsResult.data) setEvents(eventsResult.data);
    if (voiesResult.data) {
      setVoieNames(
        Object.fromEntries(voiesResult.data.map(({ id, nom }) => [id, nom])),
      );
    }
  }, [balId]);

  // Au changement de BAL et après chaque modification faite ici
  useEffect(() => {
    // Chargement asynchrone : l'état n'est mis à jour qu'à la réponse
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEvents();
  }, [loadEvents, changesVersion]);

  // Modifications faites ailleurs (ex. dans mes-adresses) : rechargement au
  // retour sur l'onglet
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadEvents();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadEvents]);

  // Fermeture au clic extérieur ou avec Échap
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

  const selectedIds = useMemo(
    () => events.filter((e) => !excluded.has(e.id)).map((e) => e.id),
    [events, excluded],
  );

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
    // Seuls des événements principaux sont ignorés : leurs enfants suivent
    const ignoreEvents = events
      .filter((e) => excluded.has(e.id))
      .map((e) => e.id);
    const { error, response } = await publishBaseLocale({
      client: createBalClient(balId),
      path: { baseLocaleId: balId },
      body: { ignoreEvents },
    });
    setPending(false);

    if (error || !response?.ok) {
      toast(
        apiErrorMessage(error) ??
          (response?.status === 403
            ? "Cette Base Adresse Locale ne peut pas être publiée pour le moment."
            : "La publication a échoué."),
        VariantType.ERROR,
        { duration: 8000 },
      );
      return;
    }

    toast(
      `${selectedIds.length} modification${selectedIds.length > 1 ? "s" : ""} publiée${selectedIds.length > 1 ? "s" : ""}.`,
      VariantType.SUCCESS,
      { duration: 5000 },
    );
    setIsOpen(false);
    await loadEvents();
    // Statut de la BAL (sélecteur) mis à jour
    router.refresh();
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <span className={styles.buttonWrapper}>
        <Button
          color="brand"
          size="small"
          icon={<Icon name={isOpen ? "arrow_drop_up" : "arrow_drop_down"} />}
          iconPosition="right"
          aria-label="Publier les modifications de la Base Adresse Locale"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => {
            if (!isOpen) void loadEvents();
            setIsOpen((open) => !open);
          }}
        >
          Publier
        </Button>
        {events.length > 0 && (
          <span
            className={styles.badge}
            aria-label={`${events.length} modification(s) non publiée(s)`}
          >
            {events.length}
          </span>
        )}
      </span>

      {isOpen && (
        <div
          className={styles.panel}
          role="dialog"
          aria-label="Modifications à publier"
        >
          {events.length === 0 ? (
            <p className={styles.empty}>
              Aucune modification depuis la dernière publication.
            </p>
          ) : (
            <div className={styles.groups}>
              {ACTION_GROUPS.map(({ action, label }) => {
                const items = events.filter((e) => e.action === action);
                if (items.length === 0) return null;
                const ids = items.map((e) => e.id);
                const allChecked = ids.every((id) => !excluded.has(id));
                return (
                  <section key={action} className={styles.group}>
                    <label
                      className={`${styles.groupHeader} ${GROUP_CLASS[action]}`}
                    >
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={(e) => toggle(ids, e.target.checked)}
                      />
                      {label} ({items.length})
                    </label>
                    <ul className={styles.items}>
                      {items.map((event) => {
                        const detail = eventDetail(event);
                        return (
                          <li key={event.id} className={styles.item}>
                            <label className={styles.itemLabel}>
                              <input
                                type="checkbox"
                                checked={!excluded.has(event.id)}
                                onChange={(e) =>
                                  toggle([event.id], e.target.checked)
                                }
                              />
                              <span className={styles.itemText}>
                                <span className={styles.itemTitle}>
                                  {eventTitle(event, voieNames)}
                                </span>
                                {detail && (
                                  <span className={styles.itemDetail}>
                                    {detail}
                                  </span>
                                )}
                              </span>
                              <span className={styles.itemDate}>
                                {formatEventDate(event.updatedAt)}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
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
                : `Publier les modifications (${selectedIds.length})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
