"use client";

import { useState } from "react";
import {
  Button,
  Checkbox,
  CheckboxGroup,
  Modal,
  ModalSize,
} from "@gouvfr-lasuite/ui-components";
import styles from "./LocalPathsFilterModal.module.css";
import { LocalPathStatus, LocalPathClassement } from "@/generated/prisma/browser";
import { CLASSEMENT_LABELS } from "@/components/voies-locales/types";

const STATUS_LABEL: Record<LocalPathStatus, string> = {
  [LocalPathStatus.DRAFT]: "Brouillon",
  [LocalPathStatus.PUBLISHED]: "Publié",
  [LocalPathStatus.CERTIFIED]: "Certifié",
};

function toggleValue<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

interface LocalPathsFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  statusFilters: Set<LocalPathStatus>;
  classementFilters: Set<LocalPathClassement>;
  onApply: (
    statusFilters: Set<LocalPathStatus>,
    classementFilters: Set<LocalPathClassement>,
  ) => void;
}

export function LocalPathsFilterModal({
  isOpen,
  onClose,
  statusFilters,
  classementFilters,
  onApply,
}: LocalPathsFilterModalProps) {
  const [draftStatus, setDraftStatus] = useState(statusFilters);
  const [draftClassement, setDraftClassement] = useState(classementFilters);

  // Réinitialise le brouillon sur les filtres appliqués à chaque ouverture.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setDraftStatus(new Set(statusFilters));
      setDraftClassement(new Set(classementFilters));
    }
  }

  function handleApply() {
    onApply(draftStatus, draftClassement);
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={ModalSize.SMALL}
      title="Filtrer les voies locales"
      rightActions={
        <>
          <Button variant="secondary" color="neutral" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleApply}>Appliquer</Button>
        </>
      }
    >
      <div className={styles.form}>
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Statut</legend>
          <CheckboxGroup>
            <div className={styles.options}>
              {Object.values(LocalPathStatus).map((s) => (
                <Checkbox
                  key={s}
                  label={STATUS_LABEL[s]}
                  checked={draftStatus.has(s)}
                  onChange={() => setDraftStatus((prev) => toggleValue(prev, s))}
                />
              ))}
            </div>
          </CheckboxGroup>
        </fieldset>
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Type</legend>
          <CheckboxGroup>
            <div className={styles.options}>
              {Object.values(LocalPathClassement).map((c) => (
                <Checkbox
                  key={c}
                  label={CLASSEMENT_LABELS[c]}
                  checked={draftClassement.has(c)}
                  onChange={() =>
                    setDraftClassement((prev) => toggleValue(prev, c))
                  }
                />
              ))}
            </div>
          </CheckboxGroup>
        </fieldset>
      </div>
    </Modal>
  );
}
