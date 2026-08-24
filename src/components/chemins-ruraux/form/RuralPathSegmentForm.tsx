"use client";

import { Input, Select } from "@gouvfr-lasuite/ui-components";
import {
  RuralPathDomanialite,
  RuralPathEtat,
  RuralPathSurface,
} from "@/generated/prisma/browser";
import { DOMANIALITE_LABELS, ETAT_LABELS, SURFACE_LABELS } from "../types";
import type { Segment, SegmentAttributes } from "../useRuralPathDrawer";
import styles from "./RuralPathSegmentForm.module.css";

const SURFACE_OPTIONS = Object.values(RuralPathSurface).map((value) => ({
  label: SURFACE_LABELS[value],
  value,
}));

const ETAT_OPTIONS = Object.values(RuralPathEtat).map((value) => ({
  label: ETAT_LABELS[value],
  value,
}));

const DOMANIALITE_OPTIONS = Object.values(RuralPathDomanialite).map(
  (value) => ({
    label: DOMANIALITE_LABELS[value],
    value,
  }),
);

interface RuralPathSegmentFormProps {
  index: number;
  segment: Segment;
  disabled?: boolean;
  onChange: (patch: Partial<SegmentAttributes>) => void;
}

export function RuralPathSegmentForm({
  index,
  segment,
  disabled,
  onChange,
}: RuralPathSegmentFormProps) {
  return (
    <div className={styles.fields}>
      <Select
        label={`Revêtement du segment ${index + 1}`}
        options={SURFACE_OPTIONS}
        value={segment.surface}
        onChange={(e) =>
          onChange({
            surface:
              (e.target.value as RuralPathSurface) ?? RuralPathSurface.EARTH,
          })
        }
        clearable={false}
        disabled={disabled}
        fullWidth
      />
      <Input
        label="Largeur moyenne (m)"
        type="number"
        min={0}
        step={1}
        fullWidth
        value={segment.largeurMoyenne ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          onChange({ largeurMoyenne: raw === "" ? null : Number(raw) });
        }}
        disabled={disabled}
      />
      <Select
        label="État d'entretien"
        options={ETAT_OPTIONS}
        value={segment.etatEntretien ?? undefined}
        onChange={(e) =>
          onChange({
            etatEntretien: e.target.value
              ? (e.target.value as RuralPathEtat)
              : null,
          })
        }
        clearable
        disabled={disabled}
        fullWidth
      />
      <Select
        label="État de conservation"
        options={ETAT_OPTIONS}
        value={segment.etatConservation ?? undefined}
        onChange={(e) =>
          onChange({
            etatConservation: e.target.value
              ? (e.target.value as RuralPathEtat)
              : null,
          })
        }
        clearable
        disabled={disabled}
        fullWidth
      />
      <Select
        label="Domanialité"
        options={DOMANIALITE_OPTIONS}
        value={segment.domanialite ?? undefined}
        onChange={(e) =>
          onChange({
            domanialite: e.target.value
              ? (e.target.value as RuralPathDomanialite)
              : null,
          })
        }
        clearable
        disabled={disabled}
        fullWidth
      />
    </div>
  );
}
