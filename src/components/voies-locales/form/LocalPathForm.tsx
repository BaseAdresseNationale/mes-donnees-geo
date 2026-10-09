"use client";

import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Checkbox,
  Input,
  Select,
  Tooltip,
  useModals,
} from "@gouvfr-lasuite/ui-components";
import turfLength from "@turf/length";
import { lineString } from "@turf/helpers";
import styles from "./LocalPathForm.module.css";
import { useLocalPathDrawer } from "../useLocalPathDrawer";
import { LocalPathSegmentForm } from "./LocalPathSegmentForm";
import { LocalPathBulkEditModal } from "./LocalPathBulkEditModal";
import { LeftPanelList } from "@/components/common/left-panel-list/LeftPanelList";
import type { Segment } from "../useLocalPathDrawer";
import { validateLocalPathInput } from "../validation";
import type { LocalPath } from "../types";
import {
  CLASSEMENT_LABELS,
  DELETION_REASON_LABELS,
  GESTIONNAIRE_LABELS,
} from "../types";
import {
  LocalPathClassement,
  LocalPathDeletionReason,
  LocalPathGestionnaire,
  LocalPathStatus,
  LocalPathRevetement,
  LocalPathType,
  LocalPathEtat,
} from "@/generated/prisma/browser";
import { VoiesLocalesFormMap } from "./LocalPathFormMap";
import { geometryBounds } from "@/lib/geo/bounds";
import MapContext from "@/contexts/MapContext";
import { MERGE_TOLERANCE_METERS, metersBetween } from "../useLocalPathDrawer";
import Link from "next/link";

interface LocalPathFormProps {
  codeCommune: string;
  initial?: LocalPath;
  otherPaths?: LocalPath[];
}

const CLASSEMENT_OPTIONS = Object.values(LocalPathClassement).map((value) => ({
  label: CLASSEMENT_LABELS[value],
  value,
}));

const GESTIONNAIRE_OPTIONS = Object.values(LocalPathGestionnaire).map(
  (value) => ({
    label: GESTIONNAIRE_LABELS[value],
    value,
  }),
);

const DELETION_REASON_OPTIONS = Object.values(LocalPathDeletionReason).map(
  (value) => ({
    label: DELETION_REASON_LABELS[value],
    value,
  }),
);

const PORTION_HINT =
  "Disponible si les segments sélectionnés sont contigus et incluent une extrémité du chemin.";

interface SegmentItem {
  segment: Segment;
  index: number;
  length: number;
  isOuter: boolean;
}

function formatLength(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

// Date locale (pas UTC) au format attendu par <input type="date">.
function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// Le <span> capte le survol, qu'un bouton désactivé ne remonte pas.
function HintWhenDisabled({
  hint,
  children,
}: {
  hint: string | null;
  children: ReactNode;
}) {
  if (!hint) return children;
  return (
    <Tooltip content={hint} placement="top">
      <span className={styles.hintAnchor}>{children}</span>
    </Tooltip>
  );
}

function DeletionReasonPrompt({
  pathName,
  onChange,
}: {
  pathName: string;
  onChange: (reason: LocalPathDeletionReason | null) => void;
}) {
  const [reason, setReason] = useState<LocalPathDeletionReason | null>(null);
  return (
    <div className={styles.deletePrompt}>
      <p>Supprimer définitivement la voie « {pathName} » ?</p>
      <Select
        label="Raison de la suppression"
        fullWidth
        options={DELETION_REASON_OPTIONS}
        value={reason ?? undefined}
        onChange={(e) => {
          const value = e.target.value
            ? (e.target.value as LocalPathDeletionReason)
            : null;
          setReason(value);
          onChange(value);
        }}
        clearable
      />
    </div>
  );
}

export function LocalPathForm({
  codeCommune,
  initial,
  otherPaths = [],
}: LocalPathFormProps) {
  const router = useRouter();
  const { mapRef, setMapMessage, setMapChildren, flyToBounds } =
    useContext(MapContext);
  const modals = useModals();
  const [pending, startTransition] = useTransition();
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");

  const [nom, setNom] = useState(initial?.nom ?? "");
  const [statut, setStatut] = useState<LocalPathStatus>(
    initial?.statut ?? LocalPathStatus.DRAFT,
  );
  const [classement, setClassement] = useState<LocalPathClassement>(
    initial?.classement ?? LocalPathClassement.CHEMIN_RURAL,
  );
  const [numero, setNumero] = useState(
    initial?.numero !== undefined ? String(initial.numero) : "",
  );
  const [commentaire, setCommentaire] = useState(initial?.commentaire ?? "");
  const [gestionnaire, setGestionnaire] =
    useState<LocalPathGestionnaire | null>(initial?.gestionnaire ?? null);
  const [dateDAffectation, setDateDAffectation] = useState(
    initial?.dateDAffectation ?? todayIsoDate(),
  );
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);
  const [checkedSegmentIds, setCheckedSegmentIds] = useState<Set<string>>(
    new Set(),
  );
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const deletionReasonRef = useRef<LocalPathDeletionReason | null>(null);

  useEffect(() => {
    if (submitStatus !== "idle") {
      const timeout = setTimeout(() => {
        setSubmitStatus("idle");
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [submitStatus]);

  // Fly to the initial path if provided
  useEffect(() => {
    if (!initial?.segments.length) return;
    const bounds = geometryBounds({
      type: "MultiLineString",
      coordinates: initial.segments.map((s) => s.path.coordinates),
    });
    flyToBounds(bounds);
  }, [flyToBounds, initial]);

  const drawer = useLocalPathDrawer(
    mapRef,
    setMapMessage,
    initial ? { segments: initial.segments } : null,
  );

  // Autres chemins dont une extrémité touche (à ~15m près) une extrémité du
  // chemin en cours d'édition (chaîne finie, ou pointe du tracé en cours si on
  // est en train de dessiner) : proposés à la fusion.
  const mergeablePaths = useMemo(() => {
    const preview = drawer.previewCoordinates;
    let chainStart = drawer.segments[0]?.coordinates[0];
    let chainEnd = drawer.segments.at(-1)?.coordinates.at(-1);
    if (preview) {
      const tip = preview.at(-1)!;
      // Le tracé en cours prolonge soit le début, soit la fin de la chaîne
      // (ou aucun des deux si elle est vide, nouveau chemin) : seule
      // l'extrémité réellement prolongée devient la pointe dynamique.
      if (chainStart && metersBetween(preview[0], chainStart) <= 5) {
        chainStart = tip;
      } else {
        chainEnd = tip;
        chainStart = chainStart ?? preview[0];
      }
    }
    if (!chainStart || !chainEnd) return [];
    return otherPaths.filter((p) => {
      if (drawer.mergedPathIds.includes(p.id)) return false;
      if (p.segments.length === 0) return false;
      const otherStart = p.segments[0].path.coordinates[0];
      const otherEnd = p.segments.at(-1)!.path.coordinates.at(-1)!;
      return (
        metersBetween(chainStart, otherStart) <= MERGE_TOLERANCE_METERS ||
        metersBetween(chainStart, otherEnd) <= MERGE_TOLERANCE_METERS ||
        metersBetween(chainEnd, otherStart) <= MERGE_TOLERANCE_METERS ||
        metersBetween(chainEnd, otherEnd) <= MERGE_TOLERANCE_METERS
      );
    });
  }, [
    drawer.segments,
    drawer.previewCoordinates,
    drawer.mergedPathIds,
    otherPaths,
  ]);

  // Exclut les segments supprimés depuis leur sélection.
  const selectedSegmentIds = useMemo(
    () =>
      new Set(
        drawer.segments
          .filter((s) => checkedSegmentIds.has(s.id))
          .map((s) => s.id),
      ),
    [drawer.segments, checkedSegmentIds],
  );
  const checkedIdsList = useMemo(
    () => [...selectedSegmentIds],
    [selectedSegmentIds],
  );

  // `useLayoutEffect` (pas `useEffect`) : doit rester dans le même flush
  // synchrone que le `flushSync` de `useLocalPathDrawer` (glisser d'un point
  // en mode sélection), sinon la ligne éditée ne se met à jour visuellement
  // qu'à l'arrêt du geste (un `useEffect` classique, passif, n'est pas
  // garanti synchrone même sous `flushSync`).
  useLayoutEffect(() => {
    const preview = drawer.previewCoordinates
      ? [
          {
            id: "__preview__",
            coordinates: drawer.previewCoordinates,
            type: LocalPathType.TRONCON,
            revetement: LocalPathRevetement.NON_REVETU,
            largeurMoyenne: null,
            etat: LocalPathEtat.BON,
            fermeALaCirculation: null,
            servitudes: [],
            delimitation: null,
          },
        ]
      : [];

    const displaySegments = [...drawer.segments, ...preview];

    setMapChildren(
      <VoiesLocalesFormMap
        drawSegments={displaySegments}
        hoveredSegmentId={hoveredSegmentId}
        checkedSegmentIds={checkedIdsList}
        onHoverSegment={setHoveredSegmentId}
        selectedSegmentId={drawer.selectedSegmentId}
        otherPaths={otherPaths}
        mergeablePaths={mergeablePaths}
        onMergePath={drawer.mergePath}
        onCommitDrawSegment={drawer.commitDrawSegment}
      />,
    );

    return () => {
      setMapChildren(null);
    };
  }, [
    setMapChildren,
    drawer.segments,
    drawer.previewCoordinates,
    drawer.mergePath,
    drawer.commitDrawSegment,
    drawer.selectedSegmentId,
    otherPaths,
    mergeablePaths,
    hoveredSegmentId,
    checkedIdsList,
  ]);

  const segmentLengths = useMemo(
    () =>
      drawer.segments.map((seg) =>
        seg.coordinates.length >= 2
          ? turfLength(lineString(seg.coordinates), { units: "meters" })
          : 0,
      ),
    [drawer.segments],
  );
  const totalLength = useMemo(
    () => segmentLengths.reduce((sum, l) => sum + l, 0),
    [segmentLengths],
  );

  const segmentItems = useMemo(
    () =>
      drawer.segments.map((segment, index) => ({
        segment,
        index,
        length: segmentLengths[index] ?? 0,
        isOuter: index === 0 || index === drawer.segments.length - 1,
      })),
    [drawer.segments, segmentLengths],
  );

  const segmentSelection = useMemo(
    () => ({
      selectedKeys: selectedSegmentIds,
      onToggle: (key: string) =>
        setCheckedSegmentIds((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        }),
      onSelectAll: (keys: string[]) =>
        setCheckedSegmentIds((prev) => new Set([...prev, ...keys])),
      onClear: () => setCheckedSegmentIds(new Set()),
    }),
    [selectedSegmentIds],
  );

  // Raccourci clavier : Delete/Backspace supprime le segment sélectionné
  // (si autorisé — `removeSegment` n'accepte que les extrémités). Ignoré quand
  // la saisie est dans un champ de formulaire.
  const { selectedSegmentId, removeSegment } = drawer;
  useEffect(() => {
    if (!selectedSegmentId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      )
        return;
      e.preventDefault();
      removeSegment(selectedSegmentId);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedSegmentId, removeSegment]);

  const isEdit = Boolean(initial);

  // Une portion (segments cochés contigus, touchant une extrémité) peut être
  // retirée du chemin sans le scinder en deux.
  const portion = useMemo(() => {
    const indices = new Set<number>();
    drawer.segments.forEach((s, i) => {
      if (selectedSegmentIds.has(s.id)) indices.add(i);
    });
    const sorted = [...indices];
    const first = sorted[0];
    const last = sorted.at(-1);
    const valid =
      sorted.length > 0 &&
      last! - first + 1 === sorted.length &&
      (first === 0 || last === drawer.segments.length - 1);
    return {
      indices,
      canRemove: valid,
      canDefuse: valid && sorted.length < drawer.segments.length,
    };
  }, [drawer.segments, selectedSegmentIds]);

  function removePortion() {
    if (!portion.canRemove) return;
    drawer.removeSegments([...selectedSegmentIds]);
    setCheckedSegmentIds(new Set());
  }

  async function defuse() {
    if (!initial || !portion.canDefuse) return;
    const decision = await modals.confirmationModal({
      title: "Défusionner ces segments ?",
      children: `Un nouveau chemin sans nom sera créé avec les ${portion.indices.size} segments sélectionnés. Ils seront retirés de ce chemin.`,
    });
    if (decision !== "yes") return;

    const all = drawer.toSegmentsInput();
    const detached = validateLocalPathInput({
      nom: null,
      statut,
      classement,
      numero: 0,
      gestionnaire,
      dateDAffectation,
      commentaire: null,
      segments: all.filter((_, i) => portion.indices.has(i)),
    });
    const remaining = validateLocalPathInput({
      nom: nom.trim() || null,
      statut,
      classement,
      numero: Number(numero),
      gestionnaire,
      dateDAffectation,
      commentaire: commentaire.trim() || null,
      segments: all.filter((_, i) => !portion.indices.has(i)),
    });
    if (!detached.ok || !remaining.ok) {
      setSubmitStatus("error");
      return;
    }

    startTransition(async () => {
      try {
        const headers = { "content-type": "application/json" };
        const created = await fetch("/api/voies-locales", {
          method: "POST",
          headers,
          body: JSON.stringify(detached.data),
        });
        if (!created.ok) {
          setSubmitStatus("error");
          return;
        }
        const newPath = (await created.json()) as LocalPath;
        const updated = await fetch(`/api/voies-locales/${initial.id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(remaining.data),
        });
        if (!updated.ok) {
          setSubmitStatus("error");
          return;
        }
        if (drawer.mergedPathIds.length > 0) {
          await Promise.allSettled(
            drawer.mergedPathIds.map((id) =>
              fetch(`/api/voies-locales/${id}`, { method: "DELETE" }),
            ),
          );
        }
        router.push(`/${codeCommune}/voies-locales/${newPath.id}`);
      } catch {
        setSubmitStatus("error");
      }
    });
  }

  function submit() {
    const parsedNumero = Number(numero);

    const validation = validateLocalPathInput({
      nom: nom.trim() || null,
      statut,
      classement,
      numero: parsedNumero,
      gestionnaire,
      dateDAffectation,
      commentaire: commentaire.trim() || null,
      segments: drawer.toSegmentsInput(),
    });
    if (!validation.ok) {
      setSubmitStatus("error");
      return;
    }

    startTransition(async () => {
      try {
        const url = isEdit
          ? `/api/voies-locales/${initial!.id}`
          : "/api/voies-locales";
        const res = await fetch(url, {
          method: isEdit ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(validation.data),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          setSubmitStatus("error");
          return;
        }
        const saved = (await res.json()) as LocalPath;
        // Les chemins fusionnés n'existent plus en tant que chemins distincts :
        // leurs segments viennent d'être absorbés dans `saved`.
        if (drawer.mergedPathIds.length > 0) {
          await Promise.allSettled(
            drawer.mergedPathIds.map((id) =>
              fetch(`/api/voies-locales/${id}`, { method: "DELETE" }),
            ),
          );
        }
        router.push(`/${codeCommune}/voies-locales/${saved.id}`);
        setSubmitStatus("success");
      } catch {
        setSubmitStatus("error");
      }
    });
  }

  async function remove() {
    if (!initial) return;
    deletionReasonRef.current = null;
    const decision = await modals.deleteConfirmationModal({
      title: "Supprimer cette voie ?",
      children: (
        <DeletionReasonPrompt
          pathName={initial.nom || "sans nom"}
          onChange={(reason) => {
            deletionReasonRef.current = reason;
          }}
        />
      ),
    });
    if (decision !== "delete") return;
    setSubmitStatus("idle");
    startTransition(async () => {
      try {
        const res = await fetch(`/api/voies-locales/${initial.id}`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ deletionReason: deletionReasonRef.current }),
        });
        if (!res.ok) {
          setSubmitStatus("error");
          return;
        }
        router.push(`/${codeCommune}/voies-locales`);
      } catch {
        setSubmitStatus("error");
      }
    });
  }

  return (
    <>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        aria-label={
          isEdit ? "Édition d'un chemin rural" : "Nouveau chemin rural"
        }
      >
        <div className={styles.header}>
          <Link href={`/${codeCommune}/voies-locales`} className={styles.back}>
            <span className="material-icons">arrow_back</span>
            Retour à la liste
          </Link>
        </div>
        <Input
          label="Nom du chemin"
          fullWidth
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          disabled={pending}
        />

        <div className={styles.pathIdentifier}>
          <Select
            label="Classement"
            className={styles.pathType}
            options={CLASSEMENT_OPTIONS}
            value={classement}
            onChange={(e) =>
              setClassement(
                (e.target.value as LocalPathClassement) ??
                  LocalPathClassement.CHEMIN_RURAL,
              )
            }
            disabled={pending}
            clearable={false}
          />

          <Input
            className={styles.pathNumber}
            label="Numéro"
            type="number"
            min={0}
            step={1}
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            disabled={pending}
          />
        </div>

        <Select
          label="Gestionnaire"
          fullWidth
          options={GESTIONNAIRE_OPTIONS}
          value={gestionnaire ?? undefined}
          onChange={(e) =>
            setGestionnaire(
              e.target.value ? (e.target.value as LocalPathGestionnaire) : null,
            )
          }
          clearable
          disabled={pending}
        />

        <Input
          label="Date d'affectation"
          type="date"
          fullWidth
          required
          value={dateDAffectation}
          onChange={(e) => setDateDAffectation(e.target.value)}
          disabled={pending}
        />

        <div className={styles.textareaField}>
          <label
            className={styles.textareaLabel}
            htmlFor="local-path-commentaire"
          >
            Commentaire
          </label>
          <textarea
            id="local-path-commentaire"
            className={styles.textarea}
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            disabled={pending}
          />
        </div>

        <section className={styles.segments} aria-label="Segments du chemin">
          <LeftPanelList<SegmentItem>
            variant="inline"
            ariaLabel="Liste des segments"
            items={segmentItems}
            getKey={(item) => item.segment.id}
            selection={segmentSelection}
            onHoverChange={setHoveredSegmentId}
            emptyMessage={
              drawer.isReady
                ? "Cliquez sur la carte pour tracer un segment."
                : "Initialisation de l'outil de dessin\u2026"
            }
            noResultsMessage="Aucun segment."
            header={
              <>
                <h3 className={styles.segmentsHeader}>
                  <span>Segments</span>
                  <span>
                    {drawer.segments.length}
                    {drawer.segments.length > 0 &&
                      ` — ${formatLength(totalLength)}`}
                  </span>
                </h3>
                {selectedSegmentIds.size >= 1 && (
                  <div className={styles.bulkActions}>
                    <Button
                      type="button"
                      size="small"
                      color="brand"
                      variant="secondary"
                      icon={<span className="material-icons">edit</span>}
                      onClick={() => setIsBulkEditOpen(true)}
                      disabled={pending || selectedSegmentIds.size < 2}
                    >
                      Édition multiple ({selectedSegmentIds.size})
                    </Button>

                    <HintWhenDisabled
                      hint={!portion.canRemove ? PORTION_HINT : null}
                    >
                      <Button
                        type="button"
                        size="small"
                        color="error"
                        variant="secondary"
                        icon={<span className="material-icons">delete</span>}
                        onClick={removePortion}
                        disabled={pending || !portion.canRemove}
                      >
                        Supprimer
                      </Button>
                    </HintWhenDisabled>
                    <HintWhenDisabled
                      hint={
                        !isEdit
                          ? "Enregistrez le chemin avant de défusionner."
                          : !portion.canDefuse
                            ? PORTION_HINT
                            : null
                      }
                    >
                      <Button
                        type="button"
                        size="small"
                        color="neutral"
                        variant="secondary"
                        icon={
                          <span className="material-icons">call_split</span>
                        }
                        onClick={defuse}
                        disabled={pending || !isEdit || !portion.canDefuse}
                      >
                        Défusionner
                      </Button>
                    </HintWhenDisabled>
                  </div>
                )}
              </>
            }
            renderItem={({ segment: seg, index: i, length, isOuter }, ctx) => (
              <div
                className={styles.segmentItem}
                onMouseEnter={ctx.onMouseEnter}
                onMouseLeave={ctx.onMouseLeave}
              >
                <Checkbox
                  type="checkbox"
                  className={styles.segmentCheckbox}
                  checked={ctx.selected}
                  onChange={ctx.toggle}
                  aria-label={`Sélectionner le segment ${i + 1}`}
                  disabled={pending}
                />
                <details
                  className={styles.segmentAccordion}
                  open={drawer.selectedSegmentId === seg.id}
                >
                  <summary
                    className={styles.segmentSummary}
                    onClick={(e) => {
                      // Contrôlé par la sélection : un seul segment ouvert à
                      // la fois, synchronisé avec le mode sélection carte.
                      e.preventDefault();
                      drawer.selectSegment(
                        drawer.selectedSegmentId === seg.id ? null : seg.id,
                      );
                    }}
                  >
                    <span className={styles.segmentLabel}>
                      Segment {i + 1}
                      <span className={styles.segmentLength}>
                        {formatLength(length)}
                      </span>
                    </span>
                  </summary>
                  <div className={styles.segmentBody}>
                    <LocalPathSegmentForm
                      index={i}
                      segment={seg}
                      disabled={pending}
                      onChange={(patch) =>
                        drawer.updateSegmentAttributes(seg.id, patch)
                      }
                    />
                  </div>
                </details>
                <Button
                  type="button"
                  variant="tertiary"
                  className={styles.segmentRemove}
                  onClick={() => drawer.removeSegment(seg.id)}
                  aria-label={
                    isOuter
                      ? `Supprimer le segment ${i + 1}`
                      : "Seules les extrémités du chemin peuvent être supprimées"
                  }
                  title={
                    isOuter
                      ? undefined
                      : "Seules les extrémités du chemin peuvent être supprimées"
                  }
                  disabled={pending || !isOuter}
                  icon={<span className="material-icons">delete</span>}
                />
              </div>
            )}
          />
        </section>

        {submitStatus === "error" && (
          <p className={styles.error} role="alert">
            Une erreur est survenue.
          </p>
        )}

        {submitStatus === "success" && (
          <p className={styles.successMessage} role="status">
            Chemin enregistré avec succès.
          </p>
        )}

        <div className={styles.actions}>
          <Button
            type="button"
            color="neutral"
            variant="tertiary"
            onClick={() => router.push(`/${codeCommune}/voies-locales`)}
            disabled={pending}
          >
            Annuler
          </Button>
          {isEdit && (
            <Button
              type="button"
              color="error"
              variant="tertiary"
              onClick={remove}
              disabled={pending}
            >
              Supprimer
            </Button>
          )}
          <span className={styles.actionsSpacer} />
          <Button type="submit" color="brand" disabled={pending}>
            {pending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </form>
      <LocalPathBulkEditModal
        isOpen={isBulkEditOpen}
        onClose={() => setIsBulkEditOpen(false)}
        count={selectedSegmentIds.size}
        onApply={(patch) =>
          drawer.updateSegmentsAttributes([...selectedSegmentIds], patch)
        }
      />
    </>
  );
}
