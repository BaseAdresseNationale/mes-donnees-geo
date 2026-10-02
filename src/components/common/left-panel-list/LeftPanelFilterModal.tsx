"use client";

import { useState } from "react";
import {
  Button,
  Checkbox,
  CheckboxGroup,
  Modal,
  ModalSize,
} from "@gouvfr-lasuite/ui-components";
import styles from "./LeftPanelFilterModal.module.css";

export interface LeftPanelFilterGroup {
  id: string;
  legend: string;
  options: { value: string; label: string }[];
}

export type LeftPanelFilterSelection = Record<string, Set<string>>;

interface LeftPanelFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  groups: LeftPanelFilterGroup[];
  selected: LeftPanelFilterSelection;
  onApply: (selected: LeftPanelFilterSelection) => void;
}

function cloneSelection(
  selection: LeftPanelFilterSelection,
): LeftPanelFilterSelection {
  const next: LeftPanelFilterSelection = {};
  for (const [groupId, values] of Object.entries(selection)) {
    next[groupId] = new Set(values);
  }
  return next;
}

export function LeftPanelFilterModal({
  isOpen,
  onClose,
  title,
  groups,
  selected,
  onApply,
}: LeftPanelFilterModalProps) {
  const [draft, setDraft] = useState<LeftPanelFilterSelection>(() =>
    cloneSelection(selected),
  );

  // Réinitialise le brouillon sur la sélection appliquée à chaque ouverture.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setDraft(cloneSelection(selected));
  }

  function toggle(groupId: string, value: string) {
    setDraft((prev) => {
      const next = cloneSelection(prev);
      const group = next[groupId] ?? new Set<string>();
      if (group.has(value)) group.delete(value);
      else group.add(value);
      next[groupId] = group;
      return next;
    });
  }

  function handleApply() {
    onApply(draft);
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={ModalSize.SMALL}
      title={title}
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
        {groups.map((group) => (
          <fieldset key={group.id} className={styles.group}>
            <legend className={styles.legend}>{group.legend}</legend>
            <CheckboxGroup>
              <div className={styles.options}>
                {group.options.map((option) => (
                  <Checkbox
                    key={option.value}
                    label={option.label}
                    checked={draft[group.id]?.has(option.value) ?? false}
                    onChange={() => toggle(group.id, option.value)}
                  />
                ))}
              </div>
            </CheckboxGroup>
          </fieldset>
        ))}
      </div>
    </Modal>
  );
}
