"use client";

import {
  Input,
  Select,
  SelectMulti,
  Switch,
} from "@gouvfr-lasuite/ui-components";
import {
  LocalPathBornage,
  LocalPathEtat,
  LocalPathRevetement,
  LocalPathServitude,
  LocalPathType,
} from "@/generated/prisma/browser";
import {
  BORNAGE_LABELS,
  ETAT_LABELS,
  REVETEMENT_LABELS,
  SERVITUDE_LABELS,
  TYPE_LABELS,
} from "../types";
import type { Segment, SegmentAttributes } from "../useLocalPathDrawer";
import styles from "./LocalPathSegmentForm.module.css";

const TYPE_OPTIONS = Object.values(LocalPathType).map((value) => ({
  label: TYPE_LABELS[value],
  value,
}));

const REVETEMENT_OPTIONS = Object.values(LocalPathRevetement).map((value) => ({
  label: REVETEMENT_LABELS[value],
  value,
}));

const ETAT_OPTIONS = Object.values(LocalPathEtat).map((value) => ({
  label: ETAT_LABELS[value],
  value,
}));

const SERVITUDE_OPTIONS = Object.values(LocalPathServitude).map((value) => ({
  label: SERVITUDE_LABELS[value],
  value,
}));

const BORNAGE_OPTIONS = Object.values(LocalPathBornage).map((value) => ({
  label: BORNAGE_LABELS[value],
  value,
}));

interface LocalPathSegmentFormProps {
  index: number;
  segment: Segment;
  disabled?: boolean;
  onChange: (patch: Partial<SegmentAttributes>) => void;
}

export function LocalPathSegmentForm({
  index,
  segment,
  disabled,
  onChange,
}: LocalPathSegmentFormProps) {
  return (
    <div className={styles.fields}>
      <Select
        label={`Type du segment ${index + 1}`}
        options={TYPE_OPTIONS}
        value={segment.type}
        onChange={(e) =>
          onChange({
            type: (e.target.value as LocalPathType) ?? LocalPathType.TRONCON,
          })
        }
        clearable={false}
        disabled={disabled}
        fullWidth
      />
      <Select
        label="Revêtement"
        options={REVETEMENT_OPTIONS}
        value={segment.revetement}
        onChange={(e) =>
          onChange({
            revetement:
              (e.target.value as LocalPathRevetement) ??
              LocalPathRevetement.NON_REVETU,
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
        label="État"
        options={ETAT_OPTIONS}
        value={segment.etat}
        onChange={(e) =>
          onChange({
            etat: (e.target.value as LocalPathEtat) ?? LocalPathEtat.BON,
          })
        }
        clearable={false}
        disabled={disabled}
        fullWidth
      />
      <SelectMulti
        label="Servitudes"
        options={SERVITUDE_OPTIONS}
        value={segment.servitudes}
        onChange={(e) =>
          onChange({ servitudes: e.target.value as LocalPathServitude[] })
        }
        disabled={disabled}
        fullWidth
      />
      <Select
        label="Bornage"
        options={BORNAGE_OPTIONS}
        value={segment.bornage ?? undefined}
        onChange={(e) =>
          onChange({
            bornage: e.target.value
              ? (e.target.value as LocalPathBornage)
              : null,
          })
        }
        clearable
        disabled={disabled}
        fullWidth
      />
      <Switch
        label="Fermé à la circulation"
        checked={segment.fermeALaCirculation ?? false}
        onChange={(e) => onChange({ fermeALaCirculation: e.target.checked })}
        disabled={disabled}
      />
    </div>
  );
}
