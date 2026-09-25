"use client";

import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select, useModals } from "@gouvfr-lasuite/ui-components";
import turfLength from "@turf/length";
import { lineString } from "@turf/helpers";
import styles from "./LocalPathForm.module.css";
import { useLocalPathDrawer } from "../useLocalPathDrawer";
import { LocalPathSegmentForm } from "./LocalPathSegmentForm";
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

interface LocalPathFormProps {
  codeCommune: string;
  initial?: LocalPath;
  otherPaths?: LocalPath[];
}

const STATUS_OPTIONS = [
  { label: "Brouillon", value: LocalPathStatus.DRAFT },
  { label: "Publié", value: LocalPathStatus.PUBLISHED },
  { label: "Certifié", value: LocalPathStatus.CERTIFIED },
];

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

function formatLength(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
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
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);
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

  // Autres chemins dont une extrémité touche (à ~15m près) une extrémité
  // du chemin en cours d'édition : proposés à la fusion.
  const mergeablePaths = useMemo(() => {
    if (drawer.segments.length === 0) return [];
    const chainStart = drawer.segments[0].coordinates[0];
    const chainEnd = drawer.segments.at(-1)!.coordinates.at(-1)!;
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
  }, [drawer.segments, drawer.mergedPathIds, otherPaths]);

  useEffect(() => {
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
            bornage: null,
          },
        ]
      : [];

    const displaySegments = [...drawer.segments, ...preview];

    setMapChildren(
      <VoiesLocalesFormMap
        drawSegments={displaySegments}
        hoveredSegmentId={hoveredSegmentId}
        mergeablePaths={mergeablePaths}
        onMergePath={drawer.mergePath}
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
    mergeablePaths,
    hoveredSegmentId,
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

  const isEdit = Boolean(initial);

  function submit() {
    const parsedNumero = Number(numero);

    const validation = validateLocalPathInput({
      nom: nom.trim() || null,
      statut,
      classement,
      numero: parsedNumero,
      gestionnaire,
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
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      aria-label={isEdit ? "Édition d'un chemin rural" : "Nouveau chemin rural"}
    >
      <h2 className={styles.title}>
        {isEdit ? initial?.nom || "Chemin sans nom" : "Nouveau chemin rural"}
      </h2>
      <p className={styles.hint}>
        Tracez le chemin sur la carte. Chaque segment porte son propre
        revêtement.
      </p>

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

      <Input
        label="Nom du chemin"
        fullWidth
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        disabled={pending}
      />

      <Select
        label="Gestionnaire"
        fullWidth
        options={GESTIONNAIRE_OPTIONS}
        value={gestionnaire ?? undefined}
        onChange={(e) =>
          setGestionnaire(
            e.target.value
              ? (e.target.value as LocalPathGestionnaire)
              : null,
          )
        }
        clearable
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

      <div
        className={styles.modeSwitch}
        role="group"
        aria-label="Mode d'édition cartographique"
      >
        <button
          type="button"
          className={`${styles.modeBtn} ${drawer.mode === "draw" ? styles.modeBtnActive : ""}`}
          onClick={() => drawer.setMode("draw")}
          aria-pressed={drawer.mode === "draw"}
          disabled={!drawer.isReady}
        >
          Dessiner
        </button>
        <button
          type="button"
          className={`${styles.modeBtn} ${drawer.mode === "select" ? styles.modeBtnActive : ""}`}
          onClick={() => drawer.setMode("select")}
          aria-pressed={drawer.mode === "select"}
          disabled={!drawer.isReady}
        >
          Sélectionner
        </button>
      </div>

      <section className={styles.segments} aria-label="Segments du chemin">
        <h3 className={styles.segmentsHeader}>
          <span>Segments</span>
          <span>
            {drawer.segments.length}
            {drawer.segments.length > 0 && ` — ${formatLength(totalLength)}`}
          </span>
        </h3>
        {drawer.segments.length === 0 ? (
          <p className={styles.segmentsEmpty}>
            {drawer.isReady
              ? "Cliquez sur la carte pour tracer un segment."
              : "Initialisation de l'outil de dessin\u2026"}
          </p>
        ) : (
          <ul className={styles.segmentList}>
            {drawer.segments.map((seg, i) => {
              const isOuterSegment =
                i === 0 || i === drawer.segments.length - 1;
              return (
                <li
                  key={seg.id}
                  className={styles.segmentItem}
                  onMouseEnter={() => setHoveredSegmentId(seg.id)}
                  onMouseLeave={() =>
                    setHoveredSegmentId((current) =>
                      current === seg.id ? null : current,
                    )
                  }
                >
                  <details className={styles.segmentAccordion}>
                    <summary className={styles.segmentSummary}>
                      <span className={styles.segmentLabel}>
                        Segment {i + 1}
                        <span className={styles.segmentLength}>
                          {formatLength(segmentLengths[i] ?? 0)}
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
                      isOuterSegment
                        ? `Supprimer le segment ${i + 1}`
                        : "Seules les extrémités du chemin peuvent être supprimées"
                    }
                    title={
                      isOuterSegment
                        ? undefined
                        : "Seules les extrémités du chemin peuvent être supprimées"
                    }
                    disabled={pending || !isOuterSegment}
                    icon={<span className="material-icons">delete</span>}
                  />
                </li>
              );
            })}
          </ul>
        )}
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
  );
}
