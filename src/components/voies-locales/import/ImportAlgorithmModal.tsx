"use client";

import { useState } from "react";
import { Button, Modal, ModalSize } from "@gouvfr-lasuite/ui-components";
import {
  IMPORT_ALGORITHMS,
  IMPORT_ALGORITHM_LABELS,
  type ImportAlgorithm,
} from "./algorithms";
import styles from "./ImportAlgorithmModal.module.css";

interface ImportAlgorithmModalProps {
  isOpen: boolean;
  initialValue: ImportAlgorithm;
  onConfirm: (algorithm: ImportAlgorithm) => void;
  onClose: () => void;
}

export function ImportAlgorithmModal({
  isOpen,
  initialValue,
  onConfirm,
  onClose,
}: ImportAlgorithmModalProps) {
  const [draft, setDraft] = useState<ImportAlgorithm>(initialValue);

  // Réinitialise le choix sur la valeur courante à chaque ouverture.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setDraft(initialValue);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={ModalSize.MEDIUM}
      title="Choisir l'algorithme de reconstitution"
      rightActions={
        <>
          <Button variant="secondary" color="neutral" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => onConfirm(draft)}>
            Lancer la reconstitution
          </Button>
        </>
      }
    >
      <fieldset className={styles.group}>
        <legend className={styles.legend}>
          Méthode d&apos;association du cadastre et de la BD TOPO
        </legend>
        {IMPORT_ALGORITHMS.map((algorithm) => {
          const { label, description } = IMPORT_ALGORITHM_LABELS[algorithm];
          return (
            <label
              key={algorithm}
              className={`${styles.option} ${draft === algorithm ? styles.optionSelected : ""}`}
            >
              <input
                type="radio"
                name="import-algorithm"
                value={algorithm}
                checked={draft === algorithm}
                onChange={() => setDraft(algorithm)}
              />
              <span className={styles.optionBody}>
                <span className={styles.optionLabel}>{label}</span>
                <span className={styles.optionDescription}>{description}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
    </Modal>
  );
}
