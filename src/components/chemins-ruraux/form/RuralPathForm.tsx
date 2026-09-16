"use client";

import { useContext, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select, useModals } from "@gouvfr-lasuite/ui-components";
import turfLength from "@turf/length";
import { lineString } from "@turf/helpers";
import styles from "./RuralPathForm.module.css";
import { useRuralPathDrawer } from "../useRuralPathDrawer";
import { RuralPathSegmentForm } from "./RuralPathSegmentForm";
import { validateRuralPathInput } from "../validation";
import type { RuralPath } from "../types";
import { CLASSEMENT_LABELS } from "../types";
import {
  RuralPathClassement,
  RuralPathStatus,
  RuralPathSurface,
} from "@/generated/prisma/browser";
import { CheminsRurauxFormMap } from "./RuralPathFormMap";
import { geometryBounds } from "@/lib/geo/bounds";
import MapContext from "@/contexts/MapContext";
import { MERGE_TOLERANCE_METERS, metersBetween } from "../useRuralPathDrawer";

interface RuralPathFormProps {
  codeCommune: string;
  initial?: RuralPath;
  otherPaths?: RuralPath[];
}

const STATUS_OPTIONS = [
  { label: "Brouillon", value: RuralPathStatus.DRAFT },
  { label: "Publié", value: RuralPathStatus.PUBLISHED },
  { label: "Certifié", value: RuralPathStatus.CERTIFIED },
];

const CLASSEMENT_OPTIONS = Object.values(RuralPathClassement).map((value) => ({
  label: CLASSEMENT_LABELS[value],
  value,
}));

function formatLength(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

export function RuralPathForm({
  codeCommune,
  initial,
  otherPaths = [],
}: RuralPathFormProps) {
  const router = useRouter();
  const { mapRef, setMapMessage, setMapChildren, flyToBounds } =
    useContext(MapContext);
  const modals = useModals();
  const [pending, startTransition] = useTransition();
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");

  const [nom, setNom] = useState(initial?.nom ?? "");
  const [statut, setStatut] = useState<RuralPathStatus>(
    initial?.statut ?? RuralPathStatus.DRAFT,
  );
  const [classement, setClassement] = useState<RuralPathClassement>(
    initial?.classement ?? RuralPathClassement.CHEMIN_RURAL,
  );
  const [numero, setNumero] = useState(
    initial?.numero !== undefined ? String(initial.numero) : "",
  );
  const [commentaire, setCommentaire] = useState(initial?.commentaire ?? "");
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);

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

  const drawer = useRuralPathDrawer(
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
            surface: RuralPathSurface.EARTH,
            largeurMoyenne: null,
            etatEntretien: null,
            etatConservation: null,
            domanialite: null,
          },
        ]
      : [];

    const displaySegments = [...drawer.segments, ...preview];

    setMapChildren(
      <CheminsRurauxFormMap
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

    const validation = validateRuralPathInput({
      nom: nom.trim() || null,
      statut,
      classement,
      numero: parsedNumero,
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
          ? `/api/chemins-ruraux/${initial!.id}`
          : "/api/chemins-ruraux";
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
        const saved = (await res.json()) as RuralPath;
        // Les chemins fusionnés n'existent plus en tant que chemins distincts :
        // leurs segments viennent d'être absorbés dans `saved`.
        if (drawer.mergedPathIds.length > 0) {
          await Promise.allSettled(
            drawer.mergedPathIds.map((id) =>
              fetch(`/api/chemins-ruraux/${id}`, { method: "DELETE" }),
            ),
          );
        }
        router.push(`/${codeCommune}/chemins-ruraux/${saved.id}`);
        setSubmitStatus("success");
      } catch {
        setSubmitStatus("error");
      }
    });
  }

  async function remove() {
    if (!initial) return;
    const decision = await modals.deleteConfirmationModal({
      title: "Supprimer ce chemin ?",
      children: `Supprimer définitivement le chemin "${initial.nom || "sans nom"}" ?`,
    });
    if (decision !== "delete") return;
    setSubmitStatus("idle");
    startTransition(async () => {
      try {
        const res = await fetch(`/api/chemins-ruraux/${initial.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          setSubmitStatus("error");
          return;
        }
        router.push(`/${codeCommune}/chemins-ruraux`);
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
              (e.target.value as RuralPathClassement) ??
                RuralPathClassement.CHEMIN_RURAL,
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

      <div className={styles.textareaField}>
        <label
          className={styles.textareaLabel}
          htmlFor="rural-path-commentaire"
        >
          Commentaire
        </label>
        <textarea
          id="rural-path-commentaire"
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
                      <RuralPathSegmentForm
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
          onClick={() => router.push(`/${codeCommune}/chemins-ruraux`)}
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
