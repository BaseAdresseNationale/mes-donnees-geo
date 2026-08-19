"use client";

import { useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select } from "@gouvfr-lasuite/ui-components";
import MapContext from "@/contexts/MapContext";
import styles from "./RuralPathForm.module.css";
import { RuralPath, RuralPathStatus, RuralPathSurface } from "./types";
import { useRuralPathDrawer } from "./useRuralPathDrawer";
import { validateRuralPathInput } from "./validation";

interface RuralPathFormProps {
  codeCommune: string;
  initial?: RuralPath;
}

const STATUS_OPTIONS = [
  { label: "Brouillon", value: RuralPathStatus.DRAFT },
  { label: "Publié", value: RuralPathStatus.PUBLISHED },
  { label: "Certifié", value: RuralPathStatus.CERTIFIED },
];

const SURFACE_OPTIONS = [
  { label: "Terre", value: RuralPathSurface.EARTH },
  { label: "Gravier", value: RuralPathSurface.GRAVEL },
  { label: "Enrobé", value: RuralPathSurface.PAVED },
  { label: "Empierré", value: RuralPathSurface.STONED },
  { label: "Herbe", value: RuralPathSurface.GRASS },
];

export function RuralPathForm({ codeCommune, initial }: RuralPathFormProps) {
  const router = useRouter();
  const { mapRef } = useContext(MapContext);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nom, setNom] = useState(initial?.nom ?? "");
  const [statut, setStatut] = useState<RuralPathStatus>(
    initial?.statut ?? RuralPathStatus.DRAFT,
  );

  const drawer = useRuralPathDrawer(
    mapRef,
    initial
      ? {
          ...(initial.path ? { path: initial.path } : {}),
          surfaces: initial.surfaces,
        }
      : null,
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
          ? `/api/plugins/rural-paths/${initial!.id}`
          : "/api/plugins/rural-paths";
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
        router.push(`/${codeCommune}/rural-paths/${saved.id}`);
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
        const res = await fetch(`/api/plugins/rural-paths/${initial.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          setError(`Échec de la suppression (${res.status}).`);
          return;
        }
        router.refresh();
        router.push(`/${codeCommune}/rural-paths`);
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
          <span>{drawer.segments.length}</span>
        </h3>
        {drawer.segments.length === 0 ? (
          <p className={styles.segmentsEmpty}>
            {drawer.isReady
              ? "Cliquez sur la carte pour tracer un segment."
              : "Initialisation de l'outil de dessin\u2026"}
          </p>
        ) : (
          <ul className={styles.segmentList}>
            {drawer.segments.map((seg, i) => (
              <li key={seg.id} className={styles.segmentItem}>
                <span className={styles.segmentLabel}>Segment {i + 1}</span>
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
                  />
                </div>
                <button
                  type="button"
                  className={styles.segmentRemove}
                  onClick={() => drawer.removeSegment(seg.id)}
                  aria-label={`Supprimer le segment ${i + 1}`}
                  disabled={pending}
                >
                  \u2715
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={styles.actions}>
        <Button
          type="button"
          color="neutral"
          variant="tertiary"
          onClick={() => router.push(`/${codeCommune}/rural-paths`)}
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
