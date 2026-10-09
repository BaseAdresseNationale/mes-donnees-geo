"use client";

import { useState } from "react";
import {
  Button,
  Input,
  Modal,
  ModalSize,
  Select,
  SelectMulti,
} from "@gouvfr-lasuite/ui-components";
import {
  LocalPathDelimitation,
  LocalPathEtat,
  LocalPathRevetement,
  LocalPathServitude,
  LocalPathType,
} from "@/generated/prisma/browser";
import {
  DELIMITATION_LABELS,
  ETAT_LABELS,
  REVETEMENT_LABELS,
  SERVITUDE_LABELS,
  TYPE_LABELS,
} from "../types";
import type { SegmentAttributes } from "../useLocalPathDrawer";
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

const DELIMITATION_OPTIONS = Object.values(LocalPathDelimitation).map((value) => ({
  label: DELIMITATION_LABELS[value],
  value,
}));

interface LocalPathBulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  count: number;
  onApply: (patch: Partial<SegmentAttributes>) => void;
}

export function LocalPathBulkEditModal({
  isOpen,
  onClose,
  count,
  onApply,
}: LocalPathBulkEditModalProps) {
  const [type, setType] = useState<LocalPathType | null>(null);
  const [revetement, setRevetement] = useState<LocalPathRevetement | null>(
    null,
  );
  const [largeur, setLargeur] = useState("");
  const [etat, setEtat] = useState<LocalPathEtat | null>(null);
  const [servitudes, setServitudes] = useState<LocalPathServitude[]>([]);
  const [delimitation, setDelimitation] = useState<LocalPathDelimitation | null>(null);

  // Réinitialise le formulaire à chaque ouverture.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setType(null);
      setRevetement(null);
      setLargeur("");
      setEtat(null);
      setServitudes([]);
      setDelimitation(null);
    }
  }

  const largeurNumber = largeur === "" ? null : Number(largeur);
  const largeurInvalid =
    largeurNumber !== null &&
    (!Number.isInteger(largeurNumber) || largeurNumber < 0);

  const patch: Partial<SegmentAttributes> = {};
  if (type) patch.type = type;
  if (revetement) patch.revetement = revetement;
  if (largeurNumber !== null && !largeurInvalid)
    patch.largeurMoyenne = largeurNumber;
  if (etat) patch.etat = etat;
  if (servitudes.length > 0) patch.servitudes = servitudes;
  if (delimitation) patch.delimitation = delimitation;

  const canApply = Object.keys(patch).length > 0 && !largeurInvalid;

  function handleApply() {
    if (!canApply) return;
    onApply(patch);
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={ModalSize.SMALL}
      title={`Édition multiple (${count} segments)`}
      rightActions={
        <>
          <Button
            type="button"
            variant="secondary"
            color="neutral"
            onClick={onClose}
          >
            Annuler
          </Button>
          <Button type="button" onClick={handleApply} disabled={!canApply}>
            Appliquer
          </Button>
        </>
      }
    >
      <div className={styles.fields}>
        <p>
          Seuls les champs renseignés sont appliqués aux {count} segments
          sélectionnés.
        </p>
        <Select
          label="Type"
          options={TYPE_OPTIONS}
          value={type ?? undefined}
          onChange={(e) =>
            setType(e.target.value ? (e.target.value as LocalPathType) : null)
          }
          clearable
          fullWidth
        />
        <Select
          label="Revêtement"
          options={REVETEMENT_OPTIONS}
          value={revetement ?? undefined}
          onChange={(e) =>
            setRevetement(
              e.target.value ? (e.target.value as LocalPathRevetement) : null,
            )
          }
          clearable
          fullWidth
        />
        <Input
          label="Largeur moyenne (m)"
          type="number"
          min={0}
          step={1}
          fullWidth
          value={largeur}
          onChange={(e) => setLargeur(e.target.value)}
          state={largeurInvalid ? "error" : undefined}
          text={largeurInvalid ? "Entier positif attendu." : undefined}
        />
        <Select
          label="État"
          options={ETAT_OPTIONS}
          value={etat ?? undefined}
          onChange={(e) =>
            setEtat(e.target.value ? (e.target.value as LocalPathEtat) : null)
          }
          clearable
          fullWidth
        />
        <SelectMulti
          label="Servitudes"
          options={SERVITUDE_OPTIONS}
          value={servitudes}
          onChange={(e) =>
            setServitudes(e.target.value as LocalPathServitude[])
          }
          fullWidth
        />
        <Select
          label="Délimitation"
          options={DELIMITATION_OPTIONS}
          value={delimitation ?? undefined}
          onChange={(e) =>
            setDelimitation(
              e.target.value ? (e.target.value as LocalPathDelimitation) : null,
            )
          }
          clearable
          fullWidth
        />
      </div>
    </Modal>
  );
}
