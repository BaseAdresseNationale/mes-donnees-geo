"use client";

import { useContext, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select } from "@gouvfr-lasuite/ui-components";
import turfLength from "@turf/length";
import { lineString } from "@turf/helpers";
import MapContext from "@/contexts/MapContext";
import styles from "./CheminsRurauxForm.module.css";
import { useRuralPathDrawer } from "./useCheminsRurauxDrawer";
import { validateRuralPathInput } from "./validation";
import type { RuralPath } from "./types";
import { SURFACE_LABELS } from "./types";
import { RuralPathStatus, RuralPathSurface } from "@/generated/prisma/browser";
import { CheminsRurauxFormMap } from "./CheminsRurauxFormMap";

interface RuralPathFormProps {
  codeCommune: string;
  initial?: RuralPath;
}

const STATUS_OPTIONS = [
  { label: "Brouillon", value: RuralPathStatus.DRAFT },
  { label: "Publié", value: RuralPathStatus.PUBLISHED },
  { label: "Certifié", value: RuralPathStatus.CERTIFIED },
];

const SURFACE_OPTIONS = Object.values(RuralPathSurface).map((value) => ({
  label: SURFACE_LABELS[value],
  value,
}));

function formatLength(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

export function RuralPathForm({ codeCommune, initial }: RuralPathFormProps) {
  const router = useRouter();
  const { mapRef, setMapMessage, setMapChildren } = useContext(MapContext);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nom, setNom] = useState(initial?.nom ?? "");
  const [statut, setStatut] = useState<RuralPathStatus>(
    initial?.statut ?? RuralPathStatus.DRAFT,
  );

  const drawer = useRuralPathDrawer(
    mapRef,
    setMapMessage,
    initial
      ? {
          ...(initial.path ? { path: initial.path } : {}),
          surfaces: initial.surfaces,
        }
      : null,
  );

  useEffect(() => {
    const preview = drawer.previewCoordinates
      ? [
          {
            id: "__preview__",
            surface: RuralPathSurface.EARTH,
            coordinates: drawer.previewCoordinates,
          },
        ]
      : [];

    const displaySegments = [...drawer.segments, ...preview];
    setMapChildren(<CheminsRurauxFormMap drawSegments={displaySegments} />);

    return () => {
      setMapChildren(null);
    };
  }, [setMapChildren, drawer.segments, drawer.previewCoordinates]);

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
    setError(null);
    const path = drawer.toMultiLineString();
    const surfaces = drawer.surfacesArray();

    const validation = validateRuralPathInput({
      nom: nom.trim() || null,
      statut,
      path,
      surfaces,
    });
    if (!validation.ok) {
      setError(validation.error);
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
          setError(
            payload?.error ?? `Échec de l'enregistrement (${res.status})`,
          );
          return;
        }
        const saved = (await res.json()) as RuralPath;
        router.refresh();
        router.push(`/${codeCommune}/chemins-ruraux/${saved.id}`);
      } catch {
        setError("Erreur réseau lors de l'enregistrement.");
      }
    });
  }

  function remove() {
    if (!initial) return;
    if (
      !window.confirm(
        `Supprimer définitivement le chemin "${initial.nom || "sans nom"}" ?`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/chemins-ruraux/${initial.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          setError(`Échec de la suppression (${res.status}).`);
          return;
        }
        router.refresh();
        router.push(`/${codeCommune}/chemins-ruraux`);
      } catch {
        setError("Erreur réseau lors de la suppression.");
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

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <Input
        label="Nom du chemin"
        fullWidth
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        disabled={pending}
      />

      <Select
        label="Statut"
        options={STATUS_OPTIONS}
        value={statut}
        onChange={(e) =>
          setStatut(
            (e.target.value as RuralPathStatus) ?? RuralPathStatus.DRAFT,
          )
        }
        disabled={pending}
        clearable={false}
        fullWidth
      />

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
                <li key={seg.id} className={styles.segmentItem}>
                  <span className={styles.segmentLabel}>
                    Segment {i + 1}
                    <span className={styles.segmentLength}>
                      {formatLength(segmentLengths[i] ?? 0)}
                    </span>
                  </span>
                  <div className={styles.segmentSelect}>
                    <Select
                      label={`Revêtement du segment ${i + 1}`}
                      hideLabel
                      options={SURFACE_OPTIONS}
                      value={seg.surface}
                      onChange={(e) =>
                        drawer.setSurface(
                          seg.id,
                          (e.target.value as RuralPathSurface) ??
                            RuralPathSurface.EARTH,
                        )
                      }
                      clearable={false}
                      disabled={pending}
                      fullWidth
                    />
                  </div>
                  <Button
                    type="button"
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
